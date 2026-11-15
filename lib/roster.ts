import { MAX_FLEX_TASKS } from "../convex/lib/lineupRules";

import type { Drop, Task } from "./backend";
import { SLOT_ORDER, type Slot } from "./slots";

export type StarterSlot = { slot: Slot; task: Task | undefined };

/**
 * Splits a roster into the five starter slots, in roster order and empty where
 * nothing is drafted, and everything else: flex tasks and the bonus tasks that
 * drops add.
 */
export function splitRoster(rows: readonly Task[]): { starters: StarterSlot[]; extras: Task[] } {
  const starters = SLOT_ORDER.filter((slot) => slot !== "flex").map((slot) => ({
    slot,
    // A drop can add a second task in a slot; the drafted one is the starter.
    task: rows.find((row) => row.slot === slot && row.source === "draft"),
  }));
  const starting = new Set(starters.map((starter) => starter.task?.taskId));
  return { starters, extras: rows.filter((row) => !starting.has(row.taskId)) };
}

/**
 * How many more flex tasks the week takes. lineup.addFlexTask enforces the
 * limit by the same count; this only decides whether Roster offers the action.
 */
export function flexTasksLeft(rows: readonly Pick<Task, "slot">[]): number {
  return Math.max(0, MAX_FLEX_TASKS - rows.filter((row) => row.slot === "flex").length);
}

/**
 * Where a drop stands in the queue for Roster's single banner: first what the
 * player can act on now. A group session has a task only once its check-in has
 * opened; before that it is an RSVP, which waits behind one that is open. Ranking
 * by kind alone hid an open check-in behind an RSVP the player may not act on.
 */
function bannerRank(drop: Pick<Drop, "kind" | "taskId">): number {
  if (drop.kind === "quicktime") return 0;
  return drop.taskId ? 1 : 2;
}

/**
 * Roster shows a single banner. When several drops are live, the one the
 * player can act on now wins, then the one closing soonest. A kind the app
 * does not know, which an older backend may still send, is skipped.
 */
export function pickBannerDrop<D extends Pick<Drop, "kind" | "closesAt" | "taskId">>(drops: readonly D[], now: number): D | undefined {
  return drops
    .filter((drop) => (drop.kind === "quicktime" || drop.kind === "group") && drop.closesAt > now)
    .sort((a, b) => bannerRank(a) - bannerRank(b) || a.closesAt - b.closesAt)[0];
}
