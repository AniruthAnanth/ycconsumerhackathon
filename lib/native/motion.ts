/**
 * Timing rules for every animation in the app, shared so the whole app moves the same way.
 * Pure numbers and functions only, so they are tested without a renderer.
 */

/** No animation in the app runs longer than this; past it a sports app starts to feel slow. */
export const MAX_MOTION_MS = 400;

/** A count-up or ticker: long enough to read as movement, short enough not to wait on. */
export const COUNT_MS = 360;

/** A standings row sliding to its new rank. */
export const REORDER_MS = 280;

/** The verdict stamp falling onto the page, then settling back from its overshoot. */
export const STAMP_DROP_MS = 170;
export const STAMP_SETTLE_MS = 130;

/** Ease-out cubic: fast start, gentle landing, the way a scoreboard digit settles. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

/**
 * The number a count-up shows `elapsed` ms into an animation from `from` to `to`, rounded to
 * `decimals` places so the digits never flicker through long fractions.
 */
export function countValue(from: number, to: number, elapsed: number, duration: number, decimals = 0): number {
  if (duration <= 0 || elapsed >= duration) return to;
  const value = from + (to - from) * easeOutCubic(elapsed / duration);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
