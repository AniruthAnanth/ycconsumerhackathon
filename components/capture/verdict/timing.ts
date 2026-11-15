/**
 * Milliseconds from the verdict arriving to each beat of the reveal. The stamp starts falling at
 * STAMP_DELAY_MS and lands about 170 ms later (StampSlam); the shake and the haptic fire on that
 * landing, not on a timer of their own. The count-up runs COUNT_MS (360 ms) from POINTS_DELAY_MS,
 * so the score has settled before the action appears.
 */
export const STAMP_DELAY_MS = 60;
export const REASON_DELAY_MS = 560;
export const POINTS_DELAY_MS = 980;
export const ACTIONS_DELAY_MS = 1500;
