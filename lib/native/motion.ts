/**
 * Named timings for the app's animations, every one taken from the motion tokens in theme/motion.ts
 * so the whole app moves the same way. Pure numbers and functions only, so they are tested without
 * a renderer.
 */
import { duration, spring } from "@/theme/motion";

/** No single animation runs longer than this; past it a sports app starts to feel slow. */
export const MAX_MOTION_MS = 400;

/** A count-up or ticker: long enough to read as movement, short enough not to wait on. */
export const COUNT_MS = duration.slow;

/** A standings row sliding to its new rank. */
export const REORDER_MS = duration.slow;

/** The verdict stamp falling onto the page, then settling back from its overshoot. */
export const STAMP_DROP_MS = duration.base;
export const STAMP_SETTLE_MS = duration.fast;

/** A fade or a tab change: short ease-out, so content arrives without a wait. */
export const FADE_MS = duration.base;

/** A bottom sheet rising from the edge of the screen. */
export const SHEET_MS = duration.slow;

/** The gap between rows of a first-load entrance, and the most rows that wait for it: the whole cascade fits in one slow beat. */
export const STAGGER_MS = duration.fast / 3;
export const STAGGER_MAX_ROWS = 8;

/** How far a pressed button or card sinks. */
export const PRESS_SCALE = 0.97;

/** The layout spring (bar fills, entrances, slides). Presses use spring.snappy. */
export const SPRING = spring.gentle;

/** The wait before a row at this index enters. Rows past the cap arrive together, so a long table never trickles in. */
export function staggerDelay(index: number): number {
  return Math.min(Math.max(index, 0), STAGGER_MAX_ROWS) * STAGGER_MS;
}

/**
 * The escrow flow on the pot card: dollars travel from each paid member into the pot, then a line
 * drops to the payout box. Every step keeps to MAX_MOTION_MS; only the sequence runs longer,
 * because it is the one place the app tells a story instead of answering a tap.
 */
/** The beat before the first dollar leaves, so the diagram is seen at rest first. */
export const ESCROW_LEAD_MS = duration.fast;
/** One dollar's trip along its curve from a member to the pot. */
export const ESCROW_TRAVEL_MS = duration.slow;
/** The gap between the dollars one member sends, so they read as a stream and not a blob. */
export const ESCROW_TRAIL_MS = duration.fast;
/** Members start this far apart at most... */
export const ESCROW_STAGGER_MS = duration.fast;
/** ...and every start fits in this window, so twelve members take no longer than six. */
export const ESCROW_STAGGER_WINDOW_MS = 600;
/** The pot swelling and relaxing as a member's money lands. */
export const ESCROW_PULSE_MS = duration.base;
/** The line drawing down from the pot, then the payout box settling in under it. */
export const ESCROW_DROP_MS = duration.base;
export const ESCROW_SETTLE_MS = duration.slow;

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
