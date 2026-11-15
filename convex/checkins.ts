/**
 * Prompted check-ins: the app and the league's Keiki agent ask for the check-in instead of
 * waiting for the player to remember it.
 *
 *   prompt         the one check-in Roster asks for right now (reactive query)
 *   recordArrival  the app saw the player arrive at a task's pinned place
 *   sweep          hourly cron: the evening text and the last-day text
 *   afterProof     scheduled when a proof passes: texts whoever the prover just went past
 *
 * Texts go only to players who opted in to playing by text, never between 10 PM and 8 AM Pacific,
 * and at most three a day each.
 *
 * This module loads rows and sends. Which check-in to ask for, when a text is allowed and every
 * word of copy are pure functions in lib/checkinRules.ts.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireUser } from "./lib/auth";
import { place } from "./schema";
import {
  ARRIVAL_WINDOW_MS,
  type CheckInTask,
  type NudgeKind,
  type Rival,
  arrivalPlace,
  arrivalText,
  eveningText,
  lastDayText,
  mayText,
  pacificClock,
  passedBy,
  passedText,
  pickCheckIn,
  pickRival,
  pointsIfProven,
  promptCopy,
  scheduledNudge,
  slotsAtStake,
} from "./lib/checkinRules";
import { isValidLatLng } from "./lib/geo";
import { pacificDay } from "./lib/week";
import { leagueStandings } from "./standings";

/** leagues.maxMembers and a week's handful of tasks keep every list far below this; it only bounds the reads. */
const MAX_ROWS = 500;

type Task = CheckInTask<Id<"tasks">>;
type Standing = { userId: Id<"users">; name: string; points: number };

// ─── The Roster prompt ───────────────────────────────────────────────────────────────────────

/**
 * The one check-in the caller should do right now in this league, or null. Roster shows it as a
 * single line with a Check In button that opens the proof camera for taskId.
 *
 * now is the client's clock floored to the minute. A query must not read the wall clock (its
 * result would not be recomputed as time passes), and a drop's countdown has to keep moving.
 */
export const prompt = query({
  args: {
    leagueId: v.id("leagues"),
    now: v.number(),
    /** Where the phone is, when the player has allowed location. */
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    /** What the phone's reverse geocoder calls where it is: a gym stands in for a Body task's missing pin. */
    placeName: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      kind: v.union(v.literal("drop"), v.literal("nearby"), v.literal("at_risk")),
      taskId: v.id("tasks"),
      /** A ticker tag: "LIVE 47M", "HERE", "9H LEFT". */
      label: v.string(),
      /** One sentence that names the rival and the gap: "Maya's up 15. Leg day flips it." */
      line: v.string(),
      /** What the proof camera shows about the task, so Check In can open it without another read. */
      task: v.object({
        title: v.string(),
        points: v.number(),
        proofType: v.union(v.literal("photo"), v.literal("photo_location"), v.literal("canvas")),
        place: v.optional(place),
        gesture: v.optional(v.string()),
      }),
    }),
  ),
  handler: async (ctx, { leagueId, now, lat, lng, placeName }) => {
    const me = await requireUser(ctx);
    const week = await weekInPlay(ctx, leagueId, now);
    if (week === null || !(await isMember(ctx, leagueId, me._id))) return null;

    const here = { lat: lat ?? Number.NaN, lng: lng ?? Number.NaN };
    const tasks = await tasksInLeague(ctx, me._id, week);
    const checkIn = pickCheckIn({
      now,
      week: { endsAt: week.endsAt, settled: week.status === "settled" },
      // Roster already gives a live drop a banner of its own, with the countdown and Submit, and
      // two strips for one drop read as two different things. So this line leaves the drop to
      // that banner and asks for the next check-in. A text has no banner beside it, which is why
      // nudge and afterProof still put the drop first.
      tasks: tasks.filter((task) => task.source !== "drop"),
      coords: isValidLatLng(here) ? here : undefined,
      placeName,
    });
    if (checkIn === null) return null;

    const copy = promptCopy(checkIn, {
      now,
      rival: await rivalOf(ctx, week, me._id, await standingsOf(ctx, week)),
      worth: pointsIfProven(checkIn.task, tasks, await proofDaysOf(ctx, me._id, week, tasks), pacificDay(now)),
    });
    const { taskId, title, points, proofType, place, gesture } = checkIn.task;
    return { kind: checkIn.kind, taskId, ...copy, task: { title, points, proofType, place, gesture } };
  },
});

// ─── Arrivals ────────────────────────────────────────────────────────────────────────────────

/**
 * The app calls this when the prompt tells the player they have arrived at a task's pinned
 * place, or at a gym with a Body task that pins no place. The photo is still required; arriving only makes it easy to send. The arrival is kept
 * because a texted photo carries no GPS (Keiki reads recentArrival so it can still count for a
 * location task), and a player who plays by text is told a reply is enough.
 */
export const recordArrival = mutation({
  args: { taskId: v.id("tasks"), lat: v.number(), lng: v.number(), placeName: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { taskId, lat, lng, placeName }) => {
    const me = await requireUser(ctx);
    const task = await ctx.db.get("tasks", taskId);
    // Only what the prompt could have shown: the caller's own open task, with the phone at its pin
    // or at a gym.
    if (task === null || task.userId !== me._id || task.status !== "open") return null;
    const arrivedAt = arrivalPlace({ task, phone: { lat, lng }, placeName });
    if (arrivedAt === null) return null;
    const now = Date.now();
    if (!(await stillInPlay(ctx, task, now))) return null;

    const last = await arrivalAt(ctx, me._id, taskId);
    if (last === null) await ctx.db.insert("arrivals", { userId: me._id, taskId, lat, lng, at: now });
    else await ctx.db.patch("arrivals", last._id, { lat, lng, at: now });

    // The app re-reads the location every minute while the player stands there. One text per
    // task per day is an invitation; more is a nag.
    const sentToday = await sentOn(ctx, me._id, pacificClock(now).day);
    if (!sentToday.some((sent) => sent.kind === "arrival" && sent.taskId === taskId)) {
      await sendText(ctx, me._id, "arrival", arrivalText(arrivedAt), taskId);
    }
    return null;
  },
});

/**
 * Where the player was when they arrived at this task's place, if that was within the last hour.
 * Keiki passes it to the referee as the location of a photo texted from there.
 *
 * This reads the clock, which a query normally must not do. It is only ever called from Keiki's
 * action at the moment a text comes in, never subscribed to, so there is no cached answer to go
 * stale.
 */
export const recentArrival = internalQuery({
  args: { userId: v.id("users"), taskId: v.id("tasks") },
  returns: v.union(v.null(), v.object({ lat: v.number(), lng: v.number(), at: v.number() })),
  handler: async (ctx, { userId, taskId }) => {
    const arrival = await arrivalAt(ctx, userId, taskId);
    if (arrival === null || Date.now() - arrival.at > ARRIVAL_WINDOW_MS) return null;
    return { lat: arrival.lat, lng: arrival.lng, at: arrival.at };
  },
});

/**
 * Whether anything can still come of proving the task: its week is being played in one of the
 * player's leagues, and a drop's task only until the drop closes. An open task from a week that
 * ended stays open for ever, and a drop's task stays open until its closing job runs; neither is
 * something to invite a check-in for.
 */
async function stillInPlay(ctx: QueryCtx, task: Doc<"tasks">, now: number): Promise<boolean> {
  if (task.dropId) {
    const drop = await ctx.db.get("drops", task.dropId);
    if (drop === null || drop.closesAt <= now) return false;
  }
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", task.userId))
    .take(MAX_ROWS);
  for (const { leagueId } of memberships) {
    const week = await weekInPlay(ctx, leagueId, now);
    if (week !== null && week.startsAt === task.weekStart && week.status !== "settled" && now < week.endsAt) return true;
  }
  return false;
}

/** One row per player and task: recordArrival moves it forward rather than adding another. */
async function arrivalAt(ctx: QueryCtx, userId: Id<"users">, taskId: Id<"tasks">): Promise<Doc<"arrivals"> | null> {
  return await ctx.db
    .query("arrivals")
    .withIndex("by_user_task", (q) => q.eq("userId", userId).eq("taskId", taskId))
    .first();
}

// ─── Scheduled texts ─────────────────────────────────────────────────────────────────────────

const SWEEP_PAGE = 100;

/**
 * The hourly cron. It only fans out: each player is judged in their own mutation, so one
 * player's odd data cannot stop everyone else's text, and no transaction grows with the user table.
 */
export const sweep = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    // Nobody can be texted in quiet hours, so there is nothing to look for.
    if (!mayText(pacificClock(Date.now()).hour, 0)) return null;

    const page = await ctx.db.query("users").paginate({ numItems: SWEEP_PAGE, cursor: cursor ?? null });
    for (const user of page.page) {
      if (user.keikiOptIn !== true) continue; // sendText would refuse; skip the work too
      await ctx.scheduler.runAfter(0, internal.checkins.nudge, { userId: user._id });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.checkins.sweep, { cursor: page.continueCursor });
    }
    return null;
  },
});

/**
 * Sends one player the scheduled text they are due this hour, if any, and returns it. Run it by
 * hand to see a player's text without waiting for the cron: npx convex run checkins:nudge '{"userId":"..."}'
 */
export const nudge = internalMutation({
  args: { userId: v.id("users") },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    const clock = pacificClock(now);
    const home = await homeLeague(ctx, userId, now);
    if (home === null) return null;

    const tasks = await tasksInLeague(ctx, userId, home.week);
    const slots = slotsAtStake(tasks);
    const checkIn = pickCheckIn({ now, week: { endsAt: home.week.endsAt, settled: false }, tasks });
    const kind = scheduledNudge({
      now,
      pacificHour: clock.hour,
      weekEndsAt: home.week.endsAt,
      sentToday: (await sentOn(ctx, userId, clock.day)).map((sent) => sent.kind),
      provedToday: (await proofDaysOf(ctx, userId, home.week, tasks)).includes(pacificDay(now)),
      slotsAtStake: slots.length,
      hasCheckIn: checkIn !== null,
    });
    if (kind === null) return null;

    const rival = await rivalOf(ctx, home.week, userId, await standingsOf(ctx, home.week));
    let text: string;
    if (kind === "last_day") text = lastDayText({ slots, stakeUsd: home.stakeUsd, rival });
    else if (checkIn !== null) text = eveningText(checkIn.task, rival);
    else return null;
    return (await sendText(ctx, userId, kind, text)) ? text : null;
  },
});

// ─── A rival goes past ───────────────────────────────────────────────────────────────────────

/**
 * Scheduled by proofs.record when a proof passes. In each league the proof counts in, it compares
 * the standings with the marks the last proof left behind, texts every member the prover just
 * went past, and leaves new marks.
 *
 * Marks exist because standings are computed, never stored: without them there is no "before"
 * to compare with, and a task's points alone miss the slot and sweep bonuses a proof can earn.
 */
export const afterProof = internalMutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get("tasks", taskId);
    if (task === null) return null;
    const drop = task.dropId ? await ctx.db.get("drops", task.dropId) : null;
    const now = Date.now();

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", task.userId))
      .take(MAX_ROWS);
    for (const { leagueId } of memberships) {
      // A drop task scores only in its drop's league, so nothing moved anywhere else.
      if (task.dropId && drop?.leagueId !== leagueId) continue;
      const league = await ctx.db.get("leagues", leagueId);
      const week = await weekInPlay(ctx, leagueId, now);
      if (league === null || week === null || week.status === "settled") continue;

      const standings = await standingsOf(ctx, week);
      const prover = standings.find((row) => row.userId === task.userId);
      if (prover === undefined) continue;
      const marks = await ctx.db
        .query("checkinMarks")
        .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId))
        .take(MAX_ROWS);
      // Every week starts from zero, so a mark left in an earlier week says nothing about this one.
      const markOf = (userId: Id<"users">) =>
        marks.find((mark) => mark.userId === userId && mark.weekStart === week.startsAt);

      const passed = passedBy({
        prover: {
          // No mark yet means this is the prover's first proof in the league. Where they stood
          // before it is where they stand now, less everything the proof added.
          before: markOf(prover.userId)?.points ?? prover.points - (await pointsAddedBy(ctx, task, week, now)),
          after: prover.points,
        },
        others: standings
          .filter((row) => row.userId !== prover.userId)
          .map((row) => ({ userId: row.userId, before: markOf(row.userId)?.points ?? row.points, after: row.points })),
      });
      for (const { userId, gap } of passed) {
        // Name the way back: the check-in the passed player would be asked for right now, and
        // what it would do to the new gap.
        const theirs = await tasksInLeague(ctx, userId, week);
        const checkIn = pickCheckIn({ now, week: { endsAt: week.endsAt, settled: false }, tasks: theirs });
        const wayBack = checkIn && {
          ...checkIn.task,
          worth: pointsIfProven(checkIn.task, theirs, await proofDaysOf(ctx, userId, week, theirs), pacificDay(now)),
        };
        await sendText(
          ctx,
          userId,
          "rival_passed",
          passedText({ rivalName: prover.name, gap, leagueName: league.name, wayBack }),
        );
      }

      // Only the prover's mark moves. Two proofs can land together, and the standings already
      // count both when the first hook runs: moving the other prover's mark here would leave
      // their own hook nothing to report, and the pass they made would go unsaid.
      const seen = { points: prover.points, weekStart: week.startsAt };
      // One row per member and league, carried from week to week rather than added to.
      const mark = marks.find((row) => row.userId === prover.userId);
      if (mark === undefined) await ctx.db.insert("checkinMarks", { leagueId, userId: prover.userId, ...seen });
      else await ctx.db.patch("checkinMarks", mark._id, seen);
    }
    return null;
  },
});

// ─── Sending ─────────────────────────────────────────────────────────────────────────────────

/**
 * What a proof that has just passed added to the prover's week: the task's points and every bonus
 * that came with it (a cleared slot, the sweep, the day's streak). It is what proving the task
 * would add if it were open again.
 */
async function pointsAddedBy(ctx: QueryCtx, task: Doc<"tasks">, week: Doc<"weeks">, now: number): Promise<number> {
  if (task.status !== "verified") return 0;
  const tasks = await tasksInLeague(ctx, task.userId, week);
  const reopened = tasks.map((other) => (other.taskId === task._id ? { ...other, status: "open" as const } : other));
  const proven = reopened.find((other) => other.taskId === task._id);
  if (proven === undefined) return 0;
  // The proof days are read with the task reopened, so this proof's own day is not among them.
  return pointsIfProven(proven, reopened, await proofDaysOf(ctx, task.userId, week, reopened), pacificDay(now));
}

/**
 * The one door from check-ins to Keiki, and where the limits hold for every kind of text: only
 * to a player who opted in to playing by text, nothing between 10 PM and 8 AM Pacific, and at
 * most three a day. The log row is written in the same transaction that counts the day's rows,
 * so two triggers racing for a player's third text cannot both send it.
 */
async function sendText(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: NudgeKind,
  text: string,
  taskId?: Id<"tasks">,
): Promise<boolean> {
  const now = Date.now();
  const clock = pacificClock(now);
  // keiki.send drops a text to anyone who has not opted in. Checking here as well keeps a text
  // that was never delivered from using up the player's three for the day.
  if ((await ctx.db.get("users", userId))?.keikiOptIn !== true) return false;
  if (!mayText(clock.hour, (await sentOn(ctx, userId, clock.day)).length)) return false;
  await ctx.db.insert("checkinNudges", { userId, kind, day: clock.day, text, sentAt: now, taskId });
  // Scheduled, never awaited: a slow or failing send must not undo the mutation that decided it.
  await ctx.scheduler.runAfter(0, internal.keiki.send, { userId, text });
  return true;
}

async function sentOn(ctx: QueryCtx, userId: Id<"users">, day: string): Promise<Doc<"checkinNudges">[]> {
  return await ctx.db
    .query("checkinNudges")
    .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
    .take(MAX_ROWS);
}

// ─── Reads shared by the functions above ─────────────────────────────────────────────────────

/** The league's week in play: the newest one that has started. A week made ahead of time is not in play yet. */
async function weekInPlay(ctx: QueryCtx, leagueId: Id<"leagues">, now: number): Promise<Doc<"weeks"> | null> {
  const weeks = await ctx.db
    .query("weeks")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .take(MAX_ROWS);
  return weeks.filter((week) => week.startsAt <= now).sort((a, b) => b.startsAt - a.startsAt)[0] ?? null;
}

async function isMember(ctx: QueryCtx, leagueId: Id<"leagues">, userId: Id<"users">): Promise<boolean> {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", userId))
    .first();
  return membership !== null;
}

/**
 * A player's tasks for the week as the rules see them. Tasks are keyed by (userId, weekStart)
 * and shared by every league the player is in, except a drop's task, which belongs to the drop's
 * league alone: it is on that league's roster and scores only there.
 */
async function tasksInLeague(ctx: QueryCtx, userId: Id<"users">, week: Doc<"weeks">): Promise<Task[]> {
  const rows = await ctx.db
    .query("tasks")
    .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", week.startsAt))
    .take(MAX_ROWS);
  const tasks: Task[] = [];
  for (const row of rows) {
    const drop = row.dropId ? await ctx.db.get("drops", row.dropId) : null;
    if (row.dropId && drop?.leagueId !== week.leagueId) continue;
    tasks.push({
      taskId: row._id,
      slot: row.slot,
      title: row.title,
      points: row.points,
      status: row.status,
      proofType: row.proofType,
      source: row.source,
      place: row.place,
      gesture: drop?.gesture,
      closesAt: drop?.closesAt ?? week.endsAt,
    });
  }
  return tasks;
}

/**
 * Every member's points in the league this week. They come from the standings module, the single
 * source of the League tab's numbers, so the gap in a prompt or a text is the gap on the table.
 */
async function standingsOf(ctx: QueryCtx, week: Doc<"weeks">): Promise<Standing[]> {
  const standings = await leagueStandings(ctx, week.leagueId, week._id);
  return standings.map(({ userId, name, points }) => ({ userId, name, points }));
}

/** The rival to name for this player: see pickRival for who that is. */
async function rivalOf(
  ctx: QueryCtx,
  week: Doc<"weeks">,
  userId: Id<"users">,
  standings: readonly Standing[],
): Promise<Rival<Id<"users">> | null> {
  const matchups = await ctx.db
    .query("matchups")
    .withIndex("by_week", (q) => q.eq("weekId", week._id))
    .take(MAX_ROWS);
  const mine = matchups.find((matchup) => matchup.userA === userId || matchup.userB === userId);
  const opponent = mine === undefined ? undefined : mine.userA === userId ? mine.userB : mine.userA;
  return pickRival(userId, standings, opponent);
}

/**
 * A text is not sent from inside a league screen, so it needs a league to take the rival from:
 * the first one the player joined whose week is still being played. The stake is every dollar
 * the player has paid into a week that is still open, across all their leagues.
 */
async function homeLeague(
  ctx: QueryCtx,
  userId: Id<"users">,
  now: number,
): Promise<{ week: Doc<"weeks">; stakeUsd: number } | null> {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_ROWS);
  let home: Doc<"weeks"> | null = null;
  let stakeUsd = 0;
  for (const membership of [...memberships].sort((a, b) => a.joinedAt - b.joinedAt)) {
    const week = await weekInPlay(ctx, membership.leagueId, now);
    if (week === null || week.status === "settled" || now >= week.endsAt) continue;
    home ??= week;
    if (membership.paid) stakeUsd += (await ctx.db.get("leagues", membership.leagueId))?.stakeUsd ?? 0;
  }
  return home === null ? null : { week: home, stakeUsd };
}

/**
 * The Pacific days this week on which the player has a proof that still stands, counted the way
 * the standings count a streak: a proof stops counting while its task is held or reopened.
 */
async function proofDaysOf(
  ctx: QueryCtx,
  userId: Id<"users">,
  week: Doc<"weeks">,
  tasks: readonly Task[],
): Promise<number[]> {
  const verified = new Set(tasks.filter((task) => task.status === "verified").map((task) => task.taskId));
  const proofs = await ctx.db
    .query("proofs")
    .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", week.startsAt))
    .take(MAX_ROWS);
  return proofs.filter((proof) => proof.pass && verified.has(proof.taskId)).map((proof) => pacificDay(proof.createdAt));
}
