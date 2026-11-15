export const WAGER_STEP = 10;
export const WAGER_MAX = 50;

/** Keeps a wager on the stepper's grid: whole steps from 0 to the cap. */
export function clampWager(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const steps = Math.round(value / WAGER_STEP);
  return Math.min(WAGER_MAX, Math.max(0, steps * WAGER_STEP));
}

export function stepWager(current: number, direction: 1 | -1): number {
  return clampWager(current + direction * WAGER_STEP);
}
