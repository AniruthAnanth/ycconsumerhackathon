/**
 * A player's weekly lineup: draft it from a voice note, lock it, add flex
 * tasks, and read it back as the roster.
 *
 * A player has one lineup per calendar week and it scores in every league
 * they belong to, so everything here is keyed by (userId, weekStart) and
 * never by league. The only league-specific rows are drop tasks, which score
 * in the drop's own league and are filtered in roster().
 */
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type QueryCtx,
} from "./_generated/server";
import { draftLineup, rateTask, transcribe } from "./ai";
import { challengerPointsByUser } from "./challenges";
import { membersInJoinOrder, membershipOf } from "./leagues";
import { requireUser } from "./lib/auth";
import {
  DEFAULT_TARGET_MINUTES,
  MAX_FLEX_TASKS,
  lineupProblem,
  shapeDraft,
  tidyTask,
  type DraftTask,
} from "./lib/lineupRules";
import {
  CORE_SLOTS,
  clampTaskPoints,
  scoreWeek,
  taskScore,
} from "./lib/scoring";
import {
  clockLabel,
  pacificDay,
  weekEndOf,
  weekStartOf,
  weekdayLabel,
} from "./lib/week";
import { addMemory, searchMemories } from "./memory";
import { place, proofType, slot } from "./schema";
import { leagueStandings } from "./standings";

const TIME_ZONE = "America/Los_Angeles";

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

// What we ask memory before every draft. It is a fixed question rather than
// the transcript so the lookup can run while the voice note is transcribed.
const MEMORY_QUERY =
  "This player's past weekly lineups: tasks they finished, slots they skipped, habits and places.";

// Reads right for a voice note and for a typed transcript.
const NO_PLAN =
  "Couldn't find a plan in that. Name a few things you want to do this week and try again.";

/**
 * Voice note (or typed transcript) in, proposed lineup out. Nothing is saved:
 * the player edits the tasks and lock() stores them.
 */
export const draft = action({
  args: {
    audioStorageId: v.optional(v.id("_storage")),
    transcript: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ transcript: string; tasks: DraftTask[] }> => {
    const userId: Id<"users"> = await ctx.runQuery(
      internal.lineup.callerId,
      {},
    );
    const [transcript, recalled] = await Promise.all([
      spokenPlan(ctx, args),
      searchMemories(userId, MEMORY_QUERY),
    ]);
    // A player in several leagues has the same week remembered once per league.
    const memories = [...new Set(recalled)];
    // A draft from silence would be five tasks the player never asked for.
    if (transcript.split(/\s+/).filter(Boolean).length < 3) {
      throw new ConvexError(NO_PLAN);
    }
    const today = new Date().toLocaleDateString("en-US", {
      timeZone: TIME_ZONE,
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const drafted = await draftLineup({ transcript, memories, today }).catch(
      (error) => {
        console.error(
          "draftLineup failed:",
          error instanceof Error ? error.message : error,
        );
        throw new ConvexError("The draft desk is busy. Try again in a moment.");
      },
    );
    // Words with no plan in them ("hello, how are you") come back empty. shapeDraft would fill
    // every slot, so they stop here.
    if (drafted.length === 0) {
      throw new ConvexError(NO_PLAN);
    }
    return { transcript, tasks: shapeDraft(drafted) };
  },
});

/** The player's words: the typed transcript when there is one, otherwise the transcribed recording. */
async function spokenPlan(
  ctx: ActionCtx,
  args: { audioStorageId?: Id<"_storage">; transcript?: string },
): Promise<string> {
  const typed = args.transcript?.trim();
  if (typed) return typed;
  if (!args.audioStorageId) {
    throw new ConvexError(
      "Record a voice note about your week to draft a lineup.",
    );
  }
  const audio = await ctx.storage.get(args.audioStorageId);
  if (audio === null) {
    throw new ConvexError("That recording is gone. Record it again.");
  }
  return await transcribe(audio).catch((error) => {
    console.error(
      "transcribe failed:",
      error instanceof Error ? error.message : error,
    );
    throw new ConvexError("Couldn't make out that recording. Try again.");
  });
}

/** Actions have no database, so draft() resolves its caller through this query. */
export const callerId = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"users">> => (await requireUser(ctx))._id,
});

// ---------------------------------------------------------------------------
// Lock
// ---------------------------------------------------------------------------

const draftTask = v.object({
  slot,
  title: v.string(),
  points: v.number(),
  proofType,
  place: v.optional(place),
  targetMinutes: v.optional(v.number()),
});

/**
 * Stores the lineup and makes it final. It targets the current week until
 * that week is locked and next week after that, so a player can draft on
 * Sunday for the week ahead or mid-week for the week they are in.
 */
export const lock = mutation({
  args: { tasks: v.array(draftTask), transcript: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ weekStart: number }> => {
    const user = await requireUser(ctx);
    const tasks = args.tasks.map(tidyTask);
    const problem = lineupProblem(tasks);
    if (problem) throw new ConvexError(problem);

    const thisWeek = weekStartOf(Date.now());
    // A week ends at the instant the next one starts, so weekEndOf names next week.
    const weekStart = (await isLocked(ctx, user._id, thisWeek))
      ? weekEndOf(thisWeek)
      : thisWeek;
    if (weekStart !== thisWeek && (await isLocked(ctx, user._id, weekStart))) {
      throw new ConvexError("Next week's lineup is already locked.");
    }

    // Flex tasks added before locking count towards the same limit of three.
    const existing = await weekTasks(ctx, user._id, weekStart);
    const flexCount = [...existing, ...tasks].filter(
      (task) => task.slot === "flex",
    ).length;
    if (flexCount > MAX_FLEX_TASKS) {
      throw new ConvexError(
        `A lineup holds at most ${MAX_FLEX_TASKS} flex tasks.`,
      );
    }

    const transcript = args.transcript?.trim() || undefined;
    const lineup = await lineupFor(ctx, user._id, weekStart);
    if (lineup) {
      await ctx.db.patch("lineups", lineup._id, {
        transcript,
        lockedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("lineups", {
        userId: user._id,
        weekStart,
        transcript,
        lockedAt: Date.now(),
      });
    }
    for (const task of tasks) {
      await ctx.db.insert("tasks", {
        ...task,
        userId: user._id,
        weekStart,
        status: "open",
        source: "draft",
      });
    }

    // Remember the week so the next draft can build on it. Scheduled because
    // a mutation can't call Supermemory, and a memory failure must not undo a lock.
    await ctx.scheduler.runAfter(0, internal.memory.add, {
      userId: user._id,
      content: lineupMemory(weekStart, tasks, transcript),
    });
    return { weekStart };
  },
});

function lineupMemory(
  weekStart: number,
  tasks: DraftTask[],
  transcript?: string,
): string {
  const lines = tasks.map(
    (task) => `${task.slot}: ${task.title} (${task.points} points)`,
  );
  const said = transcript
    ? ` What they said about the week: "${transcript}"`
    : "";
  return `Lineup locked for the week of ${weekName(weekStart)}. ${lines.join("; ")}.${said}`;
}

const weekName = (weekStart: number) =>
  new Date(weekStart).toLocaleDateString("en-US", {
    timeZone: TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  });

// ---------------------------------------------------------------------------
// Remembering how the week went
// ---------------------------------------------------------------------------

/**
 * Writes each league member's result for a finished week into their memory,
 * so the next draft can react to it ("you skipped Body twice, so here's an
 * easy one"). Settlement schedules this once per league week.
 */
export const rememberOutcomes = internalAction({
  args: { leagueId: v.id("leagues"), weekStart: v.number() },
  handler: async (ctx, args): Promise<null> => {
    const outcomes: { userId: Id<"users">; summary: string }[] =
      await ctx.runQuery(internal.lineup.weekOutcomes, args);
    await Promise.all(
      outcomes.map((outcome) => addMemory(outcome.userId, outcome.summary)),
    );
    return null;
  },
});

export const weekOutcomes = internalQuery({
  args: { leagueId: v.id("leagues"), weekStart: v.number() },
  handler: async (
    ctx,
    args,
  ): Promise<{ userId: Id<"users">; summary: string }[]> => {
    const members = await membersInJoinOrder(ctx, args.leagueId);
    const outcomes = [];
    for (const member of members) {
      // Only the player's own plan is worth remembering: drops are the league's idea, not a habit.
      const planned = (
        await weekTasks(ctx, member.userId, args.weekStart)
      ).filter((task) => !isDropSource(task.source));
      if (planned.length === 0) continue;
      const name = (task: Doc<"tasks">) => `${task.slot} "${task.title}"`;
      const done = planned.filter((task) => task.status === "verified");
      const missed = planned.filter((task) => task.status !== "verified");
      const summary = [
        `Result for the week of ${weekName(args.weekStart)}: finished ${done.length} of ${planned.length} tasks.`,
        done.length > 0 ? `Done: ${done.map(name).join("; ")}.` : "",
        missed.length > 0 ? `Not done: ${missed.map(name).join("; ")}.` : "",
      ];
      outcomes.push({
        userId: member.userId,
        summary: summary.filter(Boolean).join(" "),
      });
    }
    return outcomes;
  },
});

// ---------------------------------------------------------------------------
// Flex tasks
// ---------------------------------------------------------------------------

// A typed-in task starts mid-range so it is playable at once; the model then
// rates it on the same scale as drafted tasks a moment later.
const UNRATED_FLEX_POINTS = 20;

/** Adds an extra task to the current week. Allowed after locking, up to three per week. */
export const addFlexTask = mutation({
  args: { title: v.string() },
  handler: async (ctx, args): Promise<Id<"tasks">> => {
    const user = await requireUser(ctx);
    const task = tidyTask({
      slot: "flex",
      title: args.title,
      points: UNRATED_FLEX_POINTS,
      proofType: "photo",
    });
    if (task.title === "") throw new ConvexError("Give the task a title.");

    const weekStart = weekStartOf(Date.now());
    const existing = await weekTasks(ctx, user._id, weekStart);
    if (
      existing.filter((other) => other.slot === "flex").length >= MAX_FLEX_TASKS
    ) {
      throw new ConvexError(
        `You already have ${MAX_FLEX_TASKS} flex tasks this week.`,
      );
    }
    const taskId = await ctx.db.insert("tasks", {
      ...task,
      userId: user._id,
      weekStart,
      status: "open",
      source: "flex",
    });
    await ctx.scheduler.runAfter(0, internal.lineup.rateFlexTask, {
      taskId,
      title: task.title,
    });
    return taskId;
  },
});

export const rateFlexTask = internalAction({
  args: { taskId: v.id("tasks"), title: v.string() },
  handler: async (ctx, args): Promise<null> => {
    const points = clampTaskPoints(await rateTask(args.title));
    await ctx.runMutation(internal.lineup.setFlexPoints, {
      taskId: args.taskId,
      points,
    });
    return null;
  },
});

export const setFlexPoints = internalMutation({
  args: { taskId: v.id("tasks"), points: v.number() },
  handler: async (ctx, args): Promise<null> => {
    const task = await ctx.db.get("tasks", args.taskId);
    // Points never change under a proof: a task verified before the rating
    // arrived keeps the points it was verified at.
    if (task?.status === "open") {
      await ctx.db.patch("tasks", args.taskId, { points: args.points });
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

/** One roster row. Matches TaskRow in API.md. */
type TaskRow = {
  taskId: Id<"tasks">;
  slot: Doc<"tasks">["slot"];
  title: string;
  points: number;
  proofType: Doc<"tasks">["proofType"];
  place?: Doc<"tasks">["place"];
  /** Timelapse only: the minutes the stills must span. */
  targetMinutes?: number;
  status: Doc<"tasks">["status"];
  source: Doc<"tasks">["source"];
  /** Points on the board for this row: null until it scores. */
  score: number | null;
  verifiedAt?: number;
  thumbUrl?: string;
  dueLabel: string;
  upNext: boolean;
};

type Roster = {
  locked: boolean;
  weekStart: number;
  /** The rows' scores plus bonusPoints: the player's points on the League and Matchup tabs. */
  total: number;
  /** What the week has paid on top of the tasks' own points. Already inside total. */
  bonusPoints: number;
  /** A short name for each part of bonusPoints, such as "2 slots cleared" or "Streak". */
  bonusLabels: string[];
  rows: TaskRow[];
};

/**
 * A player's week as roster rows: the five slots in order, then flex, then
 * anything a drop added. Defaults to the caller and the current week.
 */
export const roster = query({
  args: {
    leagueId: v.optional(v.id("leagues")),
    userId: v.optional(v.id("users")),
    weekStart: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Roster> => {
    const caller = await requireUser(ctx);
    const userId = args.userId ?? caller._id;
    // Someone else's week (their tasks, places and proof photos) is for the players they share a league with.
    if (
      userId !== caller._id &&
      !(await shareALeague(ctx, caller._id, userId))
    ) {
      throw new ConvexError("That player isn't in any of your leagues.");
    }
    // Reading the clock in a query is normally wrong because the result is not
    // recomputed as time passes. Here the answer changes once a week, at
    // Monday midnight, and the app passes weekStart when it browses weeks.
    const weekStart = args.weekStart ?? weekStartOf(Date.now());

    const shown: Doc<"tasks">[] = [];
    const rows: TaskRow[] = [];
    for (const task of sortForRoster(await weekTasks(ctx, userId, weekStart))) {
      const drop = task.dropId ? await ctx.db.get("drops", task.dropId) : null;
      // A drop task belongs to one league and must not show up in another league's view.
      if (args.leagueId && task.dropId && drop?.leagueId !== args.leagueId)
        continue;
      shown.push(task);
      rows.push(await toRow(ctx, task, drop));
    }

    // Up Next is the one task the Roster screen puts Submit Proof on. A live
    // drop closes in hours, so it outranks tasks that are due on Sunday.
    const upNext =
      rows.find((row) => row.status === "open" && isDropSource(row.source)) ??
      rows.find((row) => row.status === "open");
    if (upNext) upNext.upNext = true;

    const bonus = await weekBonuses(
      ctx,
      userId,
      weekStart,
      shown,
      args.leagueId,
    );
    return {
      locked: await isLocked(ctx, userId, weekStart),
      weekStart,
      total:
        rows.reduce((sum, row) => sum + (row.score ?? 0), 0) + bonus.points,
      bonusPoints: bonus.points,
      bonusLabels: bonus.labels,
      rows,
    };
  },
});

/**
 * What the week has paid on top of the tasks' own points, so the Roster total is the same number
 * the League and Matchup tabs show. A drop's bonus is not here: drops.ts writes it into the drop
 * task's own points.
 *
 * Cleared slots, the sweep and the streak come from the shared rules in lib/scoring.ts and need no
 * league. Inside a league, standings.ts is the source of the player's points, and whatever it
 * holds beyond those rules is the league's part: challenge results, and the matchup win once the
 * week has settled.
 */
async function weekBonuses(
  ctx: QueryCtx,
  userId: Id<"users">,
  weekStart: number,
  tasks: Doc<"tasks">[],
  leagueId?: Id<"leagues">,
): Promise<{ points: number; labels: string[] }> {
  // The same days standings.ts counts: a proof pays into the streak only while its task is verified.
  const verified = new Set(
    tasks.filter((task) => task.status === "verified").map((task) => task._id),
  );
  const proofs = await ctx.db
    .query("proofs")
    .withIndex("by_user_week", (q) =>
      q.eq("userId", userId).eq("weekStart", weekStart),
    )
    .take(500);
  const days = proofs
    .filter((proof) => proof.pass && verified.has(proof.taskId))
    .map((proof) => pacificDay(proof.createdAt));
  const score = scoreWeek(tasks, days);

  const labels: string[] = [];
  if (score.slotsCleared > 0)
    labels.push(
      `${score.slotsCleared} slot${score.slotsCleared === 1 ? "" : "s"} cleared`,
    );
  if (score.finisher) labels.push("Sweep");
  if (score.streakBonus > 0) labels.push("Streak");
  const ownBonus = score.slotBonus + score.streakBonus;

  // A week the league never ran (a lineup locked ahead for next week) has no table to match.
  const week =
    leagueId &&
    (await leagueWeeks(ctx, leagueId)).find(
      (candidate) => candidate.startsAt === weekStart,
    );
  const standing =
    leagueId &&
    week &&
    (await leagueStandings(ctx, leagueId, week._id)).find(
      (member) => member.userId === userId,
    );
  if (!leagueId || !week || !standing) return { points: ownBonus, labels };

  const challenges =
    (
      await challengerPointsByUser(ctx, leagueId, {
        from: week.startsAt,
        to: week.endsAt,
      })
    ).get(userId) ?? 0;
  if (challenges !== 0) labels.push("Challenges");
  if (standing.points - score.total - challenges > 0)
    labels.push("Matchup win");
  return { points: standing.points - score.taskPoints, labels };
}

const isDropSource = (source: Doc<"tasks">["source"]) =>
  source !== "draft" && source !== "flex";

/** Core slots in roster order, then flex, then drop tasks; oldest first within each group. */
function sortForRoster(tasks: Doc<"tasks">[]): Doc<"tasks">[] {
  const rank = (task: Doc<"tasks">) => {
    if (isDropSource(task.source)) return CORE_SLOTS.length + 1;
    if (task.slot === "flex") return CORE_SLOTS.length;
    return CORE_SLOTS.indexOf(task.slot);
  };
  return [...tasks].sort(
    (a, b) => rank(a) - rank(b) || a._creationTime - b._creationTime,
  );
}

async function toRow(
  ctx: QueryCtx,
  task: Doc<"tasks">,
  drop: Doc<"drops"> | null,
): Promise<TaskRow> {
  // The proof that verified the task supplies the thumbnail and the time.
  const proof =
    task.status === "verified" || task.status === "held"
      ? (
          await ctx.db
            .query("proofs")
            .withIndex("by_task", (q) => q.eq("taskId", task._id))
            .order("desc")
            .take(10)
        ).find((candidate) => candidate.pass)
      : undefined;
  // A video can't be shown as a still, so only photo proofs get a thumbnail.
  const thumbUrl =
    proof?.storageId && proof.mediaType === "photo"
      ? await ctx.storage.getUrl(proof.storageId)
      : null;

  return {
    taskId: task._id,
    slot: task.slot,
    title: task.title,
    points: task.points,
    // Every proof is a survey video or a timelapse now; older tasks of other types read as timelapses.
    ...(task.proofType === "survey_video"
      ? { proofType: "survey_video" as const }
      : { proofType: "timelapse" as const, targetMinutes: task.targetMinutes ?? DEFAULT_TARGET_MINUTES }),
    place: task.place,
    status: task.status,
    source: task.source,
    score: taskScore(task),
    verifiedAt: proof?.createdAt,
    thumbUrl: thumbUrl ?? undefined,
    dueLabel: dueLabel(task, proof?.createdAt, drop?.closesAt),
    upNext: false,
  };
}

function dueLabel(
  task: Doc<"tasks">,
  verifiedAt?: number,
  dropClosesAt?: number,
): string {
  switch (task.status) {
    case "verified":
      return verifiedAt
        ? `Verified ${weekdayLabel(verifiedAt)} ${clockLabel(verifiedAt)}`
        : "Verified";
    case "held":
      return "Under review";
    case "failed":
      return "Missed";
    case "open":
      // A drop closes at its own time; everything else is due when the week ends, on Sunday.
      return dropClosesAt ? `Due ${clockLabel(dropClosesAt)}` : "Due Sun";
  }
}

// ---------------------------------------------------------------------------
// Shared reads
// ---------------------------------------------------------------------------

async function weekTasks(
  ctx: QueryCtx,
  userId: Id<"users">,
  weekStart: number,
): Promise<Doc<"tasks">[]> {
  // A week holds a lineup of at most eight tasks plus a handful from drops.
  return await ctx.db
    .query("tasks")
    .withIndex("by_user_week", (q) =>
      q.eq("userId", userId).eq("weekStart", weekStart),
    )
    .take(100);
}

async function leagueWeeks(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
): Promise<Doc<"weeks">[]> {
  // One row a week; 200 is close to four years of play.
  return await ctx.db
    .query("weeks")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .order("desc")
    .take(200);
}

async function lineupFor(
  ctx: QueryCtx,
  userId: Id<"users">,
  weekStart: number,
): Promise<Doc<"lineups"> | null> {
  return await ctx.db
    .query("lineups")
    .withIndex("by_user_week", (q) =>
      q.eq("userId", userId).eq("weekStart", weekStart),
    )
    .first();
}

async function shareALeague(
  ctx: QueryCtx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<boolean> {
  const mine = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", a))
    .take(100);
  for (const { leagueId } of mine) {
    const theirs = await membershipOf(ctx, leagueId, b);
    if (theirs !== null) return true;
  }
  return false;
}

async function isLocked(
  ctx: QueryCtx,
  userId: Id<"users">,
  weekStart: number,
): Promise<boolean> {
  return (await lineupFor(ctx, userId, weekStart))?.lockedAt !== undefined;
}
