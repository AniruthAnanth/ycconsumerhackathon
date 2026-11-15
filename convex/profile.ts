/**
 * A player's profile: lifetime numbers and records. Every value is derived on read from tasks,
 * proofs and drops; nothing here is stored, so the profile can't drift from the standings.
 */
import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { slot } from "./schema";

type Slot = Doc<"tasks">["slot"];
type TaskFacts = Pick<Doc<"tasks">, "slot" | "status" | "points">;

const DAY_MS = 24 * 60 * 60 * 1000;

// ---- Rules (pure) -----------------------------------------------------------------------------

/** Only a verified task is done: a held one is under challenge and may yet be reopened. */
function isDone(task: { status: Doc<"tasks">["status"] }): boolean {
  return task.status === "verified";
}

/** Share of the player's tasks that they proved, 0 to 1. No tasks means nothing to brag about: 0. */
export function completionRate(tasks: Pick<TaskFacts, "status">[]): number {
  if (tasks.length === 0) return 0;
  return tasks.filter(isDone).length / tasks.length;
}

/**
 * The slot the player clears most often; ties go to the slot that earned more points.
 * Flex means "anything", so it only wins when it is all the player has done.
 */
export function bestSlot(tasks: TaskFacts[]): Slot | null {
  const bySlot = new Map<Slot, { done: number; points: number }>();
  for (const task of tasks.filter(isDone)) {
    const total = bySlot.get(task.slot) ?? { done: 0, points: 0 };
    bySlot.set(task.slot, { done: total.done + 1, points: total.points + task.points });
  }
  const ranked = [...bySlot.entries()].sort(
    ([slotA, a], [slotB, b]) =>
      Number(slotA === "flex") - Number(slotB === "flex") || b.done - a.done || b.points - a.points,
  );
  return ranked[0]?.[0] ?? null;
}

/**
 * Numbers a moment's Los Angeles calendar day so that consecutive days differ by one.
 *
 * weekStart is that week's Monday 00:00 in Los Angeles, so whole days counted from it are Los
 * Angeles days and no time-zone arithmetic is needed here. Monday 00:00 Pacific is 07:00 or 08:00
 * UTC, the same UTC date either way, which makes the Monday's own number stable across the
 * daylight-saving change.
 */
export function calendarDay(at: number, weekStart: number): number {
  return Math.floor(weekStart / DAY_MS) + Math.floor((at - weekStart) / DAY_MS);
}

/**
 * Runs of consecutive days with at least one verified proof.
 * The current streak may end yesterday: today isn't over, so the streak is still alive.
 */
export function streaks(proofDays: number[], today: number): { current: number; longest: number } {
  const days = [...new Set(proofDays)].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let current = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    const isLastDay = i === days.length - 1;
    if (isLastDay && days[i] >= today - 1) current = run;
  }
  return { current, longest };
}

/** Points per week, keyed by weekStart, from the tasks proved in it. */
export function pointsByWeek(tasks: (TaskFacts & { weekStart: number })[]): Map<number, number> {
  const byWeek = new Map<number, number>();
  for (const task of tasks.filter(isDone)) {
    byWeek.set(task.weekStart, (byWeek.get(task.weekStart) ?? 0) + task.points);
  }
  return byWeek;
}

/** Seconds from a quick-time drop opening to the player's proof of it; the smallest is the record. */
export function fastestResponseSec(responses: { opensAt: number; provedAt: number }[]): number | undefined {
  if (responses.length === 0) return undefined;
  const fastestMs = Math.min(...responses.map((r) => Math.max(0, r.provedAt - r.opensAt)));
  return Math.round(fastestMs / 1000);
}

// ---- Query ------------------------------------------------------------------------------------

/** Several years of weekly lineups; a bound, not a page size. */
const MAX_TASKS = 2000;
const MAX_PROOFS = 4000;

export const get = query({
  args: { userId: v.id("users") },
  returns: v.object({
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    totalPoints: v.number(),
    tasksCompleted: v.number(),
    completionRate: v.number(),
    bestSlot: v.union(slot, v.null()),
    currentStreak: v.number(),
    longestStreak: v.number(),
    bestWeek: v.number(),
    fastestQuickTimeSec: v.optional(v.number()),
  }),
  handler: async (ctx, { userId }) => {
    await requireUser(ctx);
    const player = await ctx.db.get("users", userId);
    if (!player) throw new ConvexError("That player doesn't exist.");

    const [tasks, proofs, avatarUrl] = await Promise.all([
      ctx.db.query("tasks").withIndex("by_user_week", (q) => q.eq("userId", userId)).take(MAX_TASKS),
      ctx.db.query("proofs").withIndex("by_user_week", (q) => q.eq("userId", userId)).take(MAX_PROOFS),
      player.avatarStorageId ? ctx.storage.getUrl(player.avatarStorageId) : (player.image ?? null),
    ]);

    // A proof counts while its task is still verified: a successful challenge reopens the task,
    // and that proof stops earning anything, streak days included.
    const doneTaskIds = new Set(tasks.filter(isDone).map((task) => task._id));
    const standingProofs = proofs.filter((proof) => proof.pass && doneTaskIds.has(proof.taskId));

    const weekPoints = [...pointsByWeek(tasks).values()];
    // "Today" needs the clock. The result is recomputed whenever this player's tasks or proofs
    // change, so the worst case is a streak shown one day too long until their next proof.
    const newestWeekStart = Math.max(0, ...tasks.map((task) => task.weekStart));
    const { current, longest } = streaks(
      standingProofs.map((proof) => calendarDay(proof.createdAt, proof.weekStart)),
      calendarDay(Date.now(), newestWeekStart),
    );

    const quickTimeResponses = [];
    for (const task of tasks) {
      if (!task.dropId || !isDone(task)) continue;
      const drop = await ctx.db.get("drops", task.dropId);
      const proof = standingProofs.find((p) => p.taskId === task._id);
      if (drop?.kind === "quicktime" && proof) {
        quickTimeResponses.push({ opensAt: drop.opensAt, provedAt: proof.createdAt });
      }
    }
    const fastestQuickTimeSec = fastestResponseSec(quickTimeResponses);

    return {
      name: player.name ?? "Player",
      ...(avatarUrl ? { avatarUrl } : {}),
      totalPoints: weekPoints.reduce((sum, points) => sum + points, 0),
      tasksCompleted: doneTaskIds.size,
      completionRate: completionRate(tasks),
      bestSlot: bestSlot(tasks),
      currentStreak: current,
      longestStreak: longest,
      bestWeek: Math.max(0, ...weekPoints),
      ...(fastestQuickTimeSec === undefined ? {} : { fastestQuickTimeSec }),
    };
  },
});
