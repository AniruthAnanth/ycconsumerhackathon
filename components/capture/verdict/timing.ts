import { COUNT_MS, STAMP_DROP_MS, STAMP_SETTLE_MS } from "@/lib/native/motion";
import { duration } from "@/theme";

/**
 * Milliseconds from the verdict arriving to each beat of the reveal, built from the motion tokens
 * so every beat is one slow step after the last. The stamp starts falling at STAMP_DELAY_MS and
 * lands STAMP_DROP_MS later (StampSlam); the shake and the haptic fire on that landing, not on a
 * timer of their own. The count-up runs COUNT_MS from POINTS_DELAY_MS, so the score has settled
 * before the action appears.
 */
export const STAMP_DELAY_MS = 0;
export const REASON_DELAY_MS = STAMP_DELAY_MS + STAMP_DROP_MS + STAMP_SETTLE_MS;
export const POINTS_DELAY_MS = REASON_DELAY_MS + duration.slow;
export const ACTIONS_DELAY_MS = POINTS_DELAY_MS + COUNT_MS + duration.fast;
