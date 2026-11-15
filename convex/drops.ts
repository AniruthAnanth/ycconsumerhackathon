/**
 * Drops: bonus tasks that appear during a week, on top of the drafted lineup.
 *
 * A drop is one row in `drops`. A player takes part through an ordinary row in `tasks` that
 * carries the dropId, so proofs, the feed and standings treat it like any other task. This
 * module only decides when those tasks exist and what they are worth.
 *
 *   scheduled ──openDrop──▶ open ──closeDrop──▶ closed
 *
 * Both transitions are scheduled functions (ctx.scheduler), so a drop opens and closes on time
 * with no client involved, and no query has to read the clock to know whether a drop is live.
 * A mystery envelope is delivered already open; a group session opens when check-in does.
 *
 * Points live on the task row: standings sum tasks.points, so a bonus is written there the
 * moment it is earned and is never added again at read time. The scoring formulas are in
 * lib/scoring.ts with every other scoring rule; what a drop asks for, how long it lasts and the
 * wording of every text are in lib/dropRules.ts.
 */
import { ConvexError, type Infer, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { askJson } from "./ai";
import { requireUser } from "./lib/auth";
import {
  clampMysteryPoints,
  firstFinisher,
  GROUP_CHECK_IN_WINDOW_MS,
  GROUP_REMINDER_LEAD_MS,
  GROUP_SESSION_POINTS,
  groupAnnouncementText,
  groupReminderText,
  groupWrapUpText,
  HEADCOUNT_INSTRUCTIONS,
  HEADCOUNT_SCHEMA,
  MYSTERY_INSTRUCTIONS,
  MYSTERY_MEMORY_QUERY,
  MYSTERY_SCHEMA,
  MYSTERY_WINDOW_MS,
  mysteryPrompt,
  mysteryText,
  othersPresent,
  parseMystery,
  pickFallbackMystery,
  pickQuickTime,
  QUICK_TIME_WINDOW_MS,
  quickTimeText,
} from "./lib/dropRules";
import { clampWager, groupSessionScore, mysteryScore, quickTimeScore } from "./lib/scoring";
import { weekStartOf } from "./lib/week";
import { searchMemories } from "./memory";
import { place, slot } from "./schema";
import { pointsInLeague } from "./standings";

/** leagues.maxMembers keeps every list here far below this; it only bounds the reads. */
const MAX_ROWS = 500;

/** How tasks.source names a task that came from each kind of drop. */
const TASK_SOURCE = { quicktime: "drop", mystery: "mystery", group: "group" } as const;

// ─── Roster banner ───────────────────────────────────────────────────────────────────────────

const activeDrop = v.object({
  dropId: v.id("drops"),
  kind: v.union(v.literal("quicktime"), v.literal("mystery"), v.literal("group")),
  title: v.string(),
  slot,
  points: v.number(),
  gesture: v.optional(v.string()),
  sealed: v.boolean(),
  wager: v.optional(v.number()),
  place: v.optional(place),
  opensAt: v.number(),
  closesAt: v.number(),
  taskId: v.optional(v.id("tasks")),
  attendees: v.optional(
    v.array(v.object({ userId: v.id("users"), name: v.string(), checkedIn: v.boolean() })),
  ),
});

type ActiveDrop = Infer<typeof activeDrop>;

/** The drops the caller can act on in this league right now, soonest to close first. */
export const active = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(activeDrop),
  handler: async (ctx, { leagueId }) => {
    const me = await requireUser(ctx);
    if ((await membership(ctx, leagueId, me._id)) === null) return [];

    // A group session is listed from the moment it is announced, so members can RSVP; every
    // other drop only once it is open.
    const upcoming = (await dropsIn(ctx, leagueId, "scheduled")).filter((drop) => drop.kind === "group");
    const banners: ActiveDrop[] = [];
    for (const drop of [...(await dropsIn(ctx, leagueId, "open")), ...upcoming]) {
      const banner = await bannerFor(ctx, drop, me._id);
      if (banner !== null) banners.push(banner);
    }
    return banners.sort((a, b) => a.closesAt - b.closesAt);
  },
});

/** What a sealed envelope is called: its real title stays hidden until it is opened. */
const SEALED_TITLE = "Mystery task";

/** One drop as one player sees it, or null when there is nothing in it for them to do. */
async function bannerFor(ctx: QueryCtx, drop: Doc<"drops">, me: Id<"users">): Promise<ActiveDrop | null> {
  const banner = {
    dropId: drop._id,
    kind: drop.kind,
    title: drop.title,
    slot: drop.slot,
    points: drop.points,
    gesture: drop.gesture,
    sealed: drop.sealed,
    wager: drop.wager,
    place: drop.place,
    opensAt: drop.opensAt,
    closesAt: drop.closesAt,
  };
  if (drop.kind === "mystery") {
    if (drop.userId !== me) return null;
    // Sealed, an envelope shows its slot and what it pays, and nothing about the task.
    if (drop.sealed) return { ...banner, title: SEALED_TITLE, points: mysteryScore(drop.points, 0, true) };
  }
  const myTask = (await tasksOf(ctx, drop._id)).find((task) => task.userId === me);
  if (drop.kind === "group") {
    // Shown to the whole league until it closes: it is how members find the session to RSVP
    // and how attendees watch each other check in. taskId is set while I can still check in.
    const attendees = [];
    for (const rsvp of await rsvpsOf(ctx, drop._id)) {
      const attendee = await ctx.db.get("users", rsvp.userId);
      attendees.push({ userId: rsvp.userId, name: attendee?.name ?? "Player", checkedIn: rsvp.checkedIn });
    }
    return {
      ...banner,
      points: myTask?.points ?? drop.points,
      taskId: myTask?.status === "open" ? myTask._id : undefined,
      attendees,
    };
  }
  // A banner asks for one action. Once my task is verified, or I never had one because I
  // joined after the drop opened, there is nothing left for me to do.
  if (myTask?.status !== "open") return null;
  // The task's points, not the drop's: an opened envelope is worth double plus the wager.
  return { ...banner, points: myTask.points, taskId: myTask._id };
}

// ─── Quick-time drops ────────────────────────────────────────────────────────────────────────

/** Demo control: starts a quick-time drop for the league now. */
export const triggerQuickTime = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.id("drops"),
  handler: async (ctx, { leagueId }) => {
    const me = await requireUser(ctx);
    if ((await membership(ctx, leagueId, me._id)) === null) {
      throw new ConvexError("Only a member of the league can start a drop");
    }
    // One live quick-time drop per league: a texted photo has to mean exactly one drop, and
    // pressing the demo button twice must not stack banners.
    for (const drop of await dropsIn(ctx, leagueId, "open")) {
      if (drop.kind === "quicktime") await close(ctx, drop);
    }

    const now = Date.now();
    const idea = pickQuickTime();
    const dropId = await ctx.db.insert("drops", {
      leagueId,
      kind: "quicktime",
      createdBy: me._id,
      title: idea.title,
      slot: idea.slot,
      points: idea.points,
      gesture: idea.gesture,
      sealed: false,
      opensAt: now,
      closesAt: now + QUICK_TIME_WINDOW_MS,
      status: "scheduled",
    });
    await ctx.scheduler.runAt(now, internal.drops.openDrop, { dropId });
    await ctx.scheduler.runAt(now + QUICK_TIME_WINDOW_MS, internal.drops.closeDrop, { dropId });
    return dropId;
  },
});

// ─── Mystery task ────────────────────────────────────────────────────────────────────────────
//
// Each morning every player gets one sealed envelope in each of their leagues. Opening it
// (optionally with a wager) creates the task at double points. Passing costs nothing. Opening
// it and not finishing before it closes costs 20 points and the wager.

/** Cron target (crons.ts): starts an envelope for every member of every league. */
export const dailyMystery = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const league of await ctx.db.query("leagues").take(MAX_ROWS)) {
      const open = await dropsIn(ctx, league._id, "open");
      for (const member of await membersOf(ctx, league._id)) {
        // Running the job twice in a day must not hand anyone a second envelope.
        const hasEnvelope = open.some((drop) => drop.kind === "mystery" && drop.userId === member.userId);
        if (hasEnvelope) continue;
        await ctx.scheduler.runAfter(0, internal.drops.writeMystery, {
          leagueId: league._id,
          userId: member.userId,
        });
      }
    }
    return null;
  },
});

/**
 * Chooses one player's mystery task, then seals it. Supermemory is searched before the model is
 * asked, so the task reflects the player's past weeks ("you skipped Body twice, so here's an
 * easy one").
 */
export const writeMystery = internalAction({
  args: { leagueId: v.id("leagues"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { leagueId, userId }) => {
    let idea = pickFallbackMystery();
    try {
      const memories = await searchMemories(userId, MYSTERY_MEMORY_QUERY);
      const answer = await askJson<unknown>({
        name: "mystery_task",
        instructions: MYSTERY_INSTRUCTIONS,
        text: mysteryPrompt(memories),
        schema: MYSTERY_SCHEMA,
      });
      idea = parseMystery(answer) ?? idea;
    } catch (error) {
      // A morning without an envelope is worse than a generic one, so the fixed list stands in.
      console.warn(`Mystery task came from the fixed list: ${error instanceof Error ? error.message : "unknown error"}`);
    }
    await ctx.runMutation(internal.drops.sealMystery, { leagueId, userId, ...idea });
    return null;
  },
});

/** Stores the envelope, sealed and already open for the day, and texts the player. */
export const sealMystery = internalMutation({
  args: { leagueId: v.id("leagues"), userId: v.id("users"), title: v.string(), slot, points: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, userId, title, slot, points }) => {
    // Checked again here because two runs of the cron can both reach this point.
    const open = await dropsIn(ctx, leagueId, "open");
    if (open.some((drop) => drop.kind === "mystery" && drop.userId === userId)) return null;

    const now = Date.now();
    const dropId = await ctx.db.insert("drops", {
      leagueId,
      kind: "mystery",
      userId,
      title,
      slot,
      points: clampMysteryPoints(points),
      sealed: true,
      opensAt: now,
      closesAt: now + MYSTERY_WINDOW_MS,
      status: "open",
    });
    await ctx.scheduler.runAt(now + MYSTERY_WINDOW_MS, internal.drops.closeDrop, { dropId });
    await sendText(ctx, { userId }, mysteryText(slot));
    return null;
  },
});

export const acceptMystery = mutation({
  args: { dropId: v.id("drops"), wager: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { dropId, wager }) => {
    const me = await requireUser(ctx);
    await openEnvelope(ctx, me._id, dropId, wager);
    return null;
  },
});

export const passMystery = mutation({
  args: { dropId: v.id("drops") },
  returns: v.null(),
  handler: async (ctx, { dropId }) => {
    const me = await requireUser(ctx);
    await passEnvelope(ctx, me._id, dropId);
    return null;
  },
});

/** OPEN and "OPEN 30" by text: Keiki has matched the sender's phone to this user already. */
export const acceptMysteryFor = internalMutation({
  args: { userId: v.id("users"), dropId: v.id("drops"), wager: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { userId, dropId, wager }) => {
    await openEnvelope(ctx, userId, dropId, wager);
    return null;
  },
});

/** PASS by text. */
export const passMysteryFor = internalMutation({
  args: { userId: v.id("users"), dropId: v.id("drops") },
  returns: v.null(),
  handler: async (ctx, { userId, dropId }) => {
    await passEnvelope(ctx, userId, dropId);
    return null;
  },
});

async function openEnvelope(
  ctx: MutationCtx,
  userId: Id<"users">,
  dropId: Id<"drops">,
  requestedWager: number | undefined,
): Promise<void> {
  const drop = await sealedEnvelope(ctx, userId, dropId);
  // A wager is "of their own points", so it is capped at what the player has in this league.
  // An over-sized one is cut down rather than refused, so "OPEN 80" by text still opens.
  const wager = clampWager(requestedWager ?? 0, await pointsInLeague(ctx, drop.leagueId, userId));
  await ctx.db.patch("drops", dropId, { sealed: false, wager });
  // Priced for success now. If the envelope closes unfinished, close() turns this negative.
  await giveTask(ctx, drop, userId, weekStartOf(Date.now()), mysteryScore(drop.points, wager, true));
}

/** A passed envelope is closed still sealed: no task was ever created, so nothing is scored. */
async function passEnvelope(ctx: MutationCtx, userId: Id<"users">, dropId: Id<"drops">): Promise<void> {
  await sealedEnvelope(ctx, userId, dropId);
  await ctx.db.patch("drops", dropId, { status: "closed" });
}

async function sealedEnvelope(ctx: QueryCtx, userId: Id<"users">, dropId: Id<"drops">): Promise<Doc<"drops">> {
  const drop = await ctx.db.get("drops", dropId);
  if (drop === null || drop.kind !== "mystery" || drop.userId !== userId) {
    throw new ConvexError("That mystery task is not yours");
  }
  if (drop.status !== "open" || !drop.sealed) {
    throw new ConvexError("That mystery task was already opened, passed or has expired");
  }
  return drop;
}

// ─── Group sessions ──────────────────────────────────────────────────────────────────────────
//
// Any member can call a meetup: a title, a place and a start time. Others join with an RSVP.
// Check-in opens 30 minutes before the start, when the reminder goes out, and stays open for
// two hours after it. An attendee checks in with a photo taken at the place, which
// proofs.verify holds to the usual distance rule. The model then counts the people in that
// photo, and every checked-in attendee earns a bonus for each other attendee the best photo
// shows. drops.opensAt is the start time the app displays.

const groupSession = {
  leagueId: v.id("leagues"),
  title: v.string(),
  place,
  startsAt: v.number(),
};

export const createGroupSession = mutation({
  args: groupSession,
  returns: v.id("drops"),
  handler: async (ctx, session) => {
    const me = await requireUser(ctx);
    return await startGroupSession(ctx, me._id, session);
  },
});

export const rsvp = mutation({
  args: { dropId: v.id("drops") },
  returns: v.null(),
  handler: async (ctx, { dropId }) => {
    const me = await requireUser(ctx);
    await joinGroupSession(ctx, me._id, dropId);
    return null;
  },
});

/** A session proposed by text ("run tomorrow 7am at Dolores Park"), already parsed by Keiki. */
export const createGroupSessionFor = internalMutation({
  args: { userId: v.id("users"), ...groupSession },
  returns: v.id("drops"),
  handler: async (ctx, { userId, ...session }) => await startGroupSession(ctx, userId, session),
});

/** IN by text. */
export const rsvpFor = internalMutation({
  args: { userId: v.id("users"), dropId: v.id("drops") },
  returns: v.null(),
  handler: async (ctx, { userId, dropId }) => {
    await joinGroupSession(ctx, userId, dropId);
    return null;
  },
});

async function startGroupSession(
  ctx: MutationCtx,
  userId: Id<"users">,
  session: { leagueId: Id<"leagues">; title: string; place: Infer<typeof place>; startsAt: number },
): Promise<Id<"drops">> {
  if ((await membership(ctx, session.leagueId, userId)) === null) {
    throw new ConvexError("Only a member of the league can start a group session");
  }
  const title = session.title.trim();
  if (title === "") throw new ConvexError("Give the session a title");

  const now = Date.now();
  // A start time that has already passed means "now": check-in opens at once.
  const startsAt = Math.max(session.startsAt, now);
  const dropId = await ctx.db.insert("drops", {
    leagueId: session.leagueId,
    kind: "group",
    createdBy: userId,
    title,
    // One slot fits the row; standings count a verified group task toward Body and People.
    slot: "body",
    points: GROUP_SESSION_POINTS,
    sealed: false,
    place: session.place,
    opensAt: startsAt,
    closesAt: startsAt + GROUP_CHECK_IN_WINDOW_MS,
    status: "scheduled",
  });
  // Whoever calls the session is going.
  await ctx.db.insert("rsvps", { dropId, userId, checkedIn: false });
  await ctx.scheduler.runAt(Math.max(now, startsAt - GROUP_REMINDER_LEAD_MS), internal.drops.openDrop, { dropId });
  await ctx.scheduler.runAt(startsAt + GROUP_CHECK_IN_WINDOW_MS, internal.drops.closeDrop, { dropId });

  const creator = await ctx.db.get("users", userId);
  await sendText(
    ctx,
    { leagueId: session.leagueId },
    groupAnnouncementText({
      creator: creator?.name ?? "A teammate",
      title,
      placeName: session.place.name,
      startsAt,
    }),
  );
  return dropId;
}

async function joinGroupSession(ctx: MutationCtx, userId: Id<"users">, dropId: Id<"drops">): Promise<void> {
  const drop = await ctx.db.get("drops", dropId);
  if (drop === null || drop.kind !== "group") throw new ConvexError("That group session doesn't exist");
  if (drop.status === "closed") throw new ConvexError("That group session is over");
  if ((await membership(ctx, drop.leagueId, userId)) === null) {
    throw new ConvexError("Join the league to join its group sessions");
  }
  // IN sent twice, or tapped twice, is still one RSVP.
  if ((await rsvpsOf(ctx, dropId)).some((rsvp) => rsvp.userId === userId)) return;
  await ctx.db.insert("rsvps", { dropId, userId, checkedIn: false });
  // Check-in already opened, so this attendee missed the tasks openDrop handed out.
  if (drop.status === "open") await giveTask(ctx, drop, userId, weekStartOf(Date.now()));
}

/**
 * Counts the people in an attendee's check-in photo. A separate step after verification because
 * it is a second model call, and nobody should wait on it to see their check-in accepted.
 */
export const countGroupPhoto = internalAction({
  args: { dropId: v.id("drops"), taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { dropId, taskId }) => {
    const photo: { storageId: Id<"_storage">; url: string } | null = await ctx.runQuery(
      internal.drops.checkInPhoto,
      { taskId },
    );
    if (photo === null) return null;
    const { people } = await askJson<{ people: number }>({
      name: "group_headcount",
      instructions: HEADCOUNT_INSTRUCTIONS,
      text: "Count the people in this group session check-in photo.",
      imageUrls: [photo.url],
      schema: HEADCOUNT_SCHEMA,
    });
    await ctx.runMutation(internal.drops.recordHeadcount, { dropId, storageId: photo.storageId, people });
    return null;
  },
});

/** The photo that verified a check-in. A video check-in has no still the model can count. */
export const checkInPhoto = internalQuery({
  args: { taskId: v.id("tasks") },
  returns: v.union(v.null(), v.object({ storageId: v.id("_storage"), url: v.string() })),
  handler: async (ctx, { taskId }) => {
    const proofs = await ctx.db
      .query("proofs")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .order("desc")
      .take(MAX_ROWS);
    const proof = proofs.find((candidate) => candidate.pass && candidate.mediaType === "photo");
    if (proof?.storageId === undefined) return null;
    const url = await ctx.storage.getUrl(proof.storageId);
    return url === null ? null : { storageId: proof.storageId, url };
  },
});

/** Keeps the highest headcount seen: the photo showing the most people is the group photo. */
export const recordHeadcount = internalMutation({
  args: { dropId: v.id("drops"), storageId: v.id("_storage"), people: v.number() },
  returns: v.null(),
  handler: async (ctx, { dropId, storageId, people }) => {
    const drop = await ctx.db.get("drops", dropId);
    const headcount = Math.max(0, Math.floor(people));
    if (drop === null || headcount <= (drop.headcount ?? 0)) return null;
    await ctx.db.patch("drops", dropId, { headcount, groupPhotoId: storageId });
    await reprice(ctx, { ...drop, headcount });
    await pointsChanged(ctx, drop.leagueId);
    return null;
  },
});

// ─── Lifecycle ───────────────────────────────────────────────────────────────────────────────

/**
 * Scheduled for the moment a drop goes live: gives the players their task and texts them. A
 * quick-time drop goes to every member; a group session's check-in goes to those who RSVP'd.
 */
export const openDrop = internalMutation({
  args: { dropId: v.id("drops") },
  returns: v.null(),
  handler: async (ctx, { dropId }) => {
    const drop = await ctx.db.get("drops", dropId);
    // Already open, or closed before it opened because a newer drop replaced it.
    if (drop === null || drop.status !== "scheduled") return null;
    await ctx.db.patch("drops", dropId, { status: "open" });

    // Tasks are keyed by (userId, weekStart): a drop's tasks belong to the week it opens in.
    const weekStart = weekStartOf(Date.now());
    if (drop.kind === "group") {
      const startsInMs = drop.opensAt - Date.now();
      for (const { userId } of await rsvpsOf(ctx, dropId)) {
        await giveTask(ctx, drop, userId, weekStart);
        // A session called at the last minute was announced moments ago; that was the reminder.
        if (startsInMs < GROUP_REMINDER_LEAD_MS / 2 || drop.place === undefined) continue;
        await sendText(
          ctx,
          { userId },
          groupReminderText({ title: drop.title, placeName: drop.place.name, startsInMs }),
        );
      }
      return null;
    }

    for (const member of await membersOf(ctx, drop.leagueId)) {
      await giveTask(ctx, drop, member.userId, weekStart);
    }
    await sendText(
      ctx,
      { leagueId: drop.leagueId },
      quickTimeText({
        title: drop.title,
        points: drop.points,
        gesture: drop.gesture ?? "a thumbs up",
        windowMs: drop.closesAt - drop.opensAt,
      }),
    );
    return null;
  },
});

/** Scheduled for drops.closesAt. Safe to run twice: a closed drop is left alone. */
export const closeDrop = internalMutation({
  args: { dropId: v.id("drops") },
  returns: v.null(),
  handler: async (ctx, { dropId }) => {
    const drop = await ctx.db.get("drops", dropId);
    if (drop === null || drop.status === "closed") return null;
    await close(ctx, drop);
    return null;
  },
});

/**
 * Scheduled by proofs.record whenever a proof passes on a task that has a dropId. This is what
 * makes a drop bonus show up in standings the instant the proof lands.
 */
export const onTaskVerified = internalMutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get("tasks", taskId);
    if (task === null || task.dropId === undefined) return null;
    const drop = await ctx.db.get("drops", task.dropId);
    if (drop === null) return null;
    await reprice(ctx, drop);
    await pointsChanged(ctx, drop.leagueId);
    if (drop.kind === "group") {
      await ctx.scheduler.runAfter(0, internal.drops.countGroupPhoto, { dropId: drop._id, taskId });
    }
    return null;
  },
});

async function close(ctx: MutationCtx, drop: Doc<"drops">): Promise<void> {
  // Price one last time: the backstop for a verification that never reached onTaskVerified.
  await reprice(ctx, drop);
  await ctx.db.patch("drops", drop._id, { status: "closed" });
  for (const task of await tasksOf(ctx, drop._id)) {
    // Still unproven when the window shut, so it can no longer be submitted.
    if (task.status !== "open") continue;
    // A missed quick-time drop simply scores nothing. An envelope that was opened and not
    // finished costs points, and standings count the negative points of a failed task.
    const points = drop.kind === "mystery" ? mysteryScore(drop.points, drop.wager ?? 0, false) : task.points;
    await ctx.db.patch("tasks", task._id, { status: "failed", points });
  }
  // The last pricing and any mystery penalty are in.
  await pointsChanged(ctx, drop.leagueId);

  if (drop.kind !== "group") return;
  const checkedIn = (await rsvpsOf(ctx, drop._id)).filter((rsvp) => rsvp.checkedIn).length;
  // A session nobody checked in to ends quietly.
  if (checkedIn === 0) return;
  await sendText(
    ctx,
    { leagueId: drop.leagueId },
    groupWrapUpText({
      title: drop.title,
      checkedIn,
      points: groupSessionScore(drop.points, othersPresent(checkedIn, drop.headcount)),
      photoUrl: drop.groupPhotoId === undefined ? null : await ctx.storage.getUrl(drop.groupPhotoId),
    }),
  );
}

/**
 * Sets what each finished task of a drop is worth right now. It recomputes from the rows rather
 * than adding to them, so it can run on every verification and again at close without paying
 * anyone twice, and it corrects itself if a challenge later overturns the first finisher.
 * Every caller follows it with pointsChanged.
 */
async function reprice(ctx: MutationCtx, drop: Doc<"drops">): Promise<void> {
  // An envelope is priced once, when it is opened, and the wager is fixed from then on.
  if (drop.kind === "mystery") return;

  if (drop.kind === "group") {
    // A check-in is a verified task. Everyone present is worth the same, and that number
    // rises for all of them each time another attendee checks in or a fuller photo is counted.
    const present = (await tasksOf(ctx, drop._id)).filter((task) => task.status === "verified");
    const points = groupSessionScore(drop.points, othersPresent(present.length, drop.headcount));
    for (const task of present) {
      if (task.points !== points) await ctx.db.patch("tasks", task._id, { points });
    }
    for (const rsvp of await rsvpsOf(ctx, drop._id)) {
      const checkedIn = present.some((task) => task.userId === rsvp.userId);
      if (rsvp.checkedIn !== checkedIn) await ctx.db.patch("rsvps", rsvp._id, { checkedIn });
    }
    return;
  }

  const finishers = [];
  for (const task of await tasksOf(ctx, drop._id)) {
    if (task.status !== "verified") continue;
    finishers.push({ task, verifiedAt: await verifiedAt(ctx, task._id) });
  }
  const first = firstFinisher(finishers);
  for (const { task } of finishers) {
    const points = quickTimeScore(drop.points, task._id === first?.task._id);
    if (task.points !== points) await ctx.db.patch("tasks", task._id, { points });
  }
}

/**
 * Tells the modules that keep something derived from points that a drop just changed them: the
 * leaderboards rebuild the league's stored rows, and the league is texted if the lead changed
 * hands. Both are scheduled, never called, so a failure there cannot roll a bonus back.
 */
async function pointsChanged(ctx: MutationCtx, leagueId: Id<"leagues">): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.leaderboards.rebuild, { leagueId });
  await ctx.scheduler.runAfter(0, internal.leadChange.check, { leagueId });
}

/** When the proof that currently verifies a task was recorded, on the server's clock. */
async function verifiedAt(ctx: QueryCtx, taskId: Id<"tasks">): Promise<number> {
  const proofs = await ctx.db
    .query("proofs")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .take(MAX_ROWS);
  const passedAt = proofs.filter((proof) => proof.pass).map((proof) => proof.createdAt);
  // A verified task always has a passing proof; one without (hand-edited data) ranks last.
  return passedAt.length > 0 ? Math.max(...passedAt) : Number.MAX_SAFE_INTEGER;
}

// ─── Reads shared by the functions above ─────────────────────────────────────────────────────

async function dropsIn(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  status: Doc<"drops">["status"],
): Promise<Doc<"drops">[]> {
  return await ctx.db
    .query("drops")
    .withIndex("by_league_status", (q) => q.eq("leagueId", leagueId).eq("status", status))
    .take(MAX_ROWS);
}

/**
 * A player takes part in a drop through an ordinary task that carries the dropId, which is why
 * proofs, the feed and standings need no drop logic of their own.
 */
async function giveTask(
  ctx: MutationCtx,
  drop: Doc<"drops">,
  userId: Id<"users">,
  weekStart: number,
  points = drop.points,
): Promise<Id<"tasks">> {
  return await ctx.db.insert("tasks", {
    userId,
    weekStart,
    slot: drop.slot,
    title: drop.title,
    points,
    // A drop with a place is a check-in: the photo has to be taken there.
    proofType: drop.place === undefined ? "photo" : "photo_location",
    place: drop.place,
    status: "open",
    source: TASK_SOURCE[drop.kind],
    dropId: drop._id,
  });
}

async function rsvpsOf(ctx: QueryCtx, dropId: Id<"drops">): Promise<Doc<"rsvps">[]> {
  return await ctx.db
    .query("rsvps")
    .withIndex("by_drop", (q) => q.eq("dropId", dropId))
    .take(MAX_ROWS);
}

async function tasksOf(ctx: QueryCtx, dropId: Id<"drops">): Promise<Doc<"tasks">[]> {
  return await ctx.db
    .query("tasks")
    .withIndex("by_drop", (q) => q.eq("dropId", dropId))
    .take(MAX_ROWS);
}

async function membersOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"memberships">[]> {
  return await ctx.db
    .query("memberships")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .take(MAX_ROWS);
}

async function membership(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  userId: Id<"users">,
): Promise<Doc<"memberships"> | null> {
  return await ctx.db
    .query("memberships")
    .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", userId))
    .first();
}

// ─── Texts ───────────────────────────────────────────────────────────────────────────────────

/**
 * The one door from drops to Keiki. keiki.send texts one player, or every member of a league
 * one by one. The text is scheduled, never awaited, so a slow or failing send cannot delay or
 * roll back the mutation that changed the drop.
 */
async function sendText(
  ctx: MutationCtx,
  to: { userId: Id<"users"> } | { leagueId: Id<"leagues"> },
  text: string,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.keiki.send, { ...to, text });
}
