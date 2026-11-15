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

const BANNER_PRIORITY: Record<Drop["kind"], number> = { quicktime: 0, mystery: 1, group: 2 };

/**
 * Roster shows a single banner. When several drops are live, the most urgent
 * kind wins, then the one closing soonest.
 */
export function pickBannerDrop<D extends Pick<Drop, "kind" | "closesAt">>(drops: readonly D[], now: number): D | undefined {
  return drops
    .filter((drop) => drop.closesAt > now)
    .sort((a, b) => BANNER_PRIORITY[a.kind] - BANNER_PRIORITY[b.kind] || a.closesAt - b.closesAt)[0];
}
