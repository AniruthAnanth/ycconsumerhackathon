/**
 * A player's profile: lifetime numbers and records. Every value is derived on read from tasks,
 * proofs and drops; nothing here is stored, so the profile can't drift from the standings.
 */
import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { shareALeague } from "./feed";
import { requireUser } from "./lib/auth";
import { currentStreak, longestStreak, scoreWeek, type ScorableTask } from "./lib/scoring";
import { pacificDay } from "./lib/week";
import { slot } from "./schema";

type Slot = Doc<"tasks">["slot"];
type TaskFacts = Pick<Doc<"tasks">, "slot" | "status" | "points">;

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
 * Each week's points, keyed by weekStart, scored by the same rules as the standings (task points,
 * slot and sweep bonuses, streak bonus). Bonuses that belong to one league, the matchup win and
 * challenge results, are left out: a profile is the player across all their leagues.
 */
export function pointsByWeek(
  tasks: (ScorableTask & { weekStart: number })[],
  proofs: { weekStart: number; day: number }[],
): Map<number, number> {
  const byWeek = new Map<number, number>();
  for (const weekStart of new Set(tasks.map((task) => task.weekStart))) {
    const score = scoreWeek(
      tasks.filter((task) => task.weekStart === weekStart),
      proofs.filter((proof) => proof.weekStart === weekStart).map((proof) => proof.day),
    );
    byWeek.set(weekStart, score.total);
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
    const viewer = await requireUser(ctx);
    const player = await ctx.db.get("users", userId);
    if (!player) throw new ConvexError("That player doesn't exist.");
    // A profile is a player's whole record, so it is for the players they share a league with.
    if (!(await shareALeague(ctx, viewer._id, userId))) {
      throw new ConvexError("You can only see profiles of players in your leagues.");
    }

    const [tasks, proofs, avatarUrl] = await Promise.all([
      ctx.db.query("tasks").withIndex("by_user_week", (q) => q.eq("userId", userId)).take(MAX_TASKS),
      ctx.db.query("proofs").withIndex("by_user_week", (q) => q.eq("userId", userId)).take(MAX_PROOFS),
      player.avatarStorageId ? ctx.storage.getUrl(player.avatarStorageId) : (player.image ?? null),
    ]);

    // A proof counts while its task is still verified: a successful challenge reopens the task,
    // and that proof stops earning anything, streak days included.
    const doneTaskIds = new Set(tasks.filter(isDone).map((task) => task._id));
    const standingProofs = proofs.filter((proof) => proof.pass && doneTaskIds.has(proof.taskId));

    const proofDays = standingProofs.map((proof) => ({
      weekStart: proof.weekStart,
      day: pacificDay(proof.createdAt),
    }));
    const weekPoints = [...pointsByWeek(tasks, proofDays).values()];
    const days = proofDays.map((proof) => proof.day);

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
      // "Today" needs the clock. The result is recomputed whenever this player's tasks or proofs
      // change, so the worst case is a streak shown a day too long until their next proof.
      currentStreak: currentStreak(days, pacificDay(Date.now())),
      longestStreak: longestStreak(days),
      bestWeek: Math.max(0, ...weekPoints),
      ...(fastestQuickTimeSec === undefined ? {} : { fastestQuickTimeSec }),
    };
  },
});
