import type { Slot } from "./slots";
import { formatScore } from "./taskText";

/** The five slots a player must clear for a perfect week; flex never counts. */
export const STARTER_SLOTS: readonly Slot[] = ["body", "mind", "recharge", "chores", "people"];

/** What the toast says the moment the fifth starter slot verifies. */
export const PERFECT_WEEK_TOAST = "5/5 Perfect week";

/** A task is done once its proof verified. A held task is still being reviewed, so it is not done yet. */
export function isDone(status: string | undefined): boolean {
  return status === "verified";
}

/** True only for the change into done, so a row that mounts already done shows its final state without a celebration. */
export function justDone(previous: string | undefined, next: string | undefined): boolean {
  return !isDone(previous) && isDone(next);
}

/** Every starter slot holds a verified task. */
export function isPerfectWeek(rows: readonly { slot: Slot; status?: string }[]): boolean {
  return STARTER_SLOTS.every((slot) => rows.some((row) => row.slot === slot && isDone(row.status)));
}

/** "+30": the points a done task banked. */
export function formatGain(points: number): string {
  return `+${formatScore(points)}`;
}

/**
 * When each haptic tick of a count-up fires, in ms from its start: one per point, capped at maxTicks
 * and spread evenly over the count, so a +40 reads as a short ratchet rather than a buzz.
 */
export function tickTimes(delta: number, durationMs: number, maxTicks: number): number[] {
  const count = Math.min(maxTicks, Math.ceil(Math.abs(delta)));
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, index) => Math.round((index * durationMs) / count));
}
