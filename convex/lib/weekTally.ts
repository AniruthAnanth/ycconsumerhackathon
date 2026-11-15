/**
 * One player's week in one league, boiled down to the numbers leaderboards rank
 * by. Pure: convex/leaderboards.ts loads the rows through indexes and calls in.
 *
 * Points, slots and streaks come from lib/scoring.ts, the same functions the
 * standings use, so a board can never disagree with the League tab. This file
 * only adds what a board needs beyond a total: points per slot, the best
 * proof, the fastest quick-time response and the days played.
 *
 * `before` replays the week as it stood at an earlier moment. That is how a
 * board knows where everyone was yesterday without a snapshot being stored
 * every night.
 */
import type { Infer } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { scoreStats } from "../schema";
import { CORE_SLOTS, longestStreak, scoreWeek, type CoreSlot } from "./scoring";
import { pacificDay } from "./week";

export type ScoreStats = Infer<typeof scoreStats>;

export type WeekFacts = {
  weekStart: number;
  /** The player's tasks that score in this league: a drop's task counts only in the drop's league. */
  tasks: Pick<Doc<"tasks">, "_id" | "slot" | "status" | "points" | "source" | "dropId">[];
  proofs: Pick<Doc<"proofs">, "_id" | "taskId" | "pass" | "highlight" | "createdAt">[];
  /** When each quick-time drop among `tasks` opened, to time the response to it. */
  quickTimeOpenedAt: Map<Id<"drops">, number>;
  /** Points that are not a task: what the player's challenges won or lost them in this league. */
  adjustment: number;
};

export type WeekTally = {
  stats: ScoreStats;
  /** Days of the week (0 is Monday) with a verified proof. */
  activeDays: number[];
};

export const NO_STATS: ScoreStats = {
  points: 0,
  slotsCleared: 0,
  streak: 0,
  tasksVerified: 0,
  slotPoints: { body: 0, mind: 0, recharge: 0, chores: 0, people: 0 },
  bestHighlight: 0,
};

export function tallyWeek(facts: WeekFacts, before = Infinity): WeekTally {
  // The proof that verified each task is its latest pass. An earlier one can be a proof the
  // league voted down: the challenge reopened the task and it was proved again, and the
  // overturned row still says pass.
  const passes = new Map<Id<"tasks">, WeekFacts["proofs"][number]>();
  for (const proof of [...facts.proofs].sort((a, b) => a.createdAt - b.createdAt)) {
    if (proof.pass) passes.set(proof.taskId, proof);
  }

  // Replaying an earlier moment: a task proved after it was still open then. A
  // verified task with no proof row (seeded history) has no date, so it counts throughout.
  const tasks = facts.tasks.map((task) =>
    task.status === "verified" && (passes.get(task._id)?.createdAt ?? -Infinity) >= before
      ? { ...task, status: "open" as const }
      : task,
  );
  const verified = tasks.filter((task) => task.status === "verified");
  // A proof stands while its task is verified: one under challenge stops earning, streak days included.
  const standing = verified.flatMap((task) => passes.get(task._id) ?? []);

  const proofDays = standing.map((proof) => pacificDay(proof.createdAt));
  const score = scoreWeek(tasks, proofDays);

  const slotPoints = { ...NO_STATS.slotPoints };
  for (const task of verified) {
    if (isCoreSlot(task.slot)) slotPoints[task.slot] += task.points;
  }

  const best = standing.reduce<WeekFacts["proofs"][number] | undefined>(
    (top, proof) => (top === undefined || proof.highlight > top.highlight ? proof : top),
    undefined,
  );

  const responses = verified.flatMap((task) => {
    const openedAt = task.dropId === undefined ? undefined : facts.quickTimeOpenedAt.get(task.dropId);
    const proof = passes.get(task._id);
    if (openedAt === undefined || proof === undefined) return [];
    return [Math.max(0, Math.round((proof.createdAt - openedAt) / 1000))];
  });

  const monday = pacificDay(facts.weekStart);
  return {
    stats: {
      points: score.total + facts.adjustment,
      slotsCleared: score.slotsCleared,
      streak: longestStreak(proofDays),
      tasksVerified: verified.length,
      slotPoints,
      bestHighlight: best?.highlight ?? 0,
      ...(best === undefined ? {} : { bestProofId: best._id }),
      ...(responses.length === 0 ? {} : { fastestQuickTimeSec: Math.min(...responses) }),
    },
    activeDays: [...new Set(proofDays.map((day) => day - monday))].sort((a, b) => a - b),
  };
}

/**
 * Several weeks as one line of a board: totals, the best proof and fastest
 * response across them, and the longest streak with days joined across week
 * boundaries (Sunday into Monday is still a run).
 */
export function totalStats(weeks: ({ weekStart: number } & WeekTally)[]): ScoreStats {
  const total: ScoreStats = { ...NO_STATS, slotPoints: { ...NO_STATS.slotPoints } };
  for (const { stats } of weeks) {
    total.points += stats.points;
    total.slotsCleared += stats.slotsCleared;
    total.tasksVerified += stats.tasksVerified;
    for (const slot of CORE_SLOTS) total.slotPoints[slot] += stats.slotPoints[slot];
    if (stats.bestHighlight > total.bestHighlight) {
      total.bestHighlight = stats.bestHighlight;
      total.bestProofId = stats.bestProofId;
    }
    if (stats.fastestQuickTimeSec !== undefined) {
      total.fastestQuickTimeSec = Math.min(total.fastestQuickTimeSec ?? Infinity, stats.fastestQuickTimeSec);
    }
  }
  if (total.bestProofId === undefined) delete total.bestProofId;
  total.streak = longestStreak(
    weeks.flatMap(({ weekStart, activeDays }) => activeDays.map((day) => pacificDay(weekStart) + day)),
  );
  return total;
}

function isCoreSlot(slot: Doc<"tasks">["slot"]): slot is CoreSlot {
  return (CORE_SLOTS as readonly string[]).includes(slot);
}
