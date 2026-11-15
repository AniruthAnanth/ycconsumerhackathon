import {
  ESCROW_DROP_MS,
  ESCROW_LEAD_MS,
  ESCROW_SETTLE_MS,
  ESCROW_STAGGER_MS,
  ESCROW_STAGGER_WINDOW_MS,
  ESCROW_TRAIL_MS,
  ESCROW_TRAVEL_MS,
} from "@/lib/native/motion";

/** Dollars each member sends: enough to read as money moving, few enough to stay cheap with twelve members. */
export const COINS_PER_MEMBER = 3;

/** From a member's first dollar leaving to their last one landing. */
export const LANE_MS = ESCROW_TRAVEL_MS + (COINS_PER_MEMBER - 1) * ESCROW_TRAIL_MS;

export type EscrowTimeline = {
  /** When each member's first dollar leaves, in ms from the start. */
  starts: number[];
  /** When each member's first dollar reaches the pot: the pot counts up and pulses then. */
  landings: number[];
  /** When the last dollar is in and the line to the payout box may start to draw. */
  settleAt: number;
  endsAt: number;
};

/**
 * When everything in the flow happens for `count` members paying in together. The gap between
 * members shrinks as the league grows, so the whole sequence stays under two seconds.
 */
export function escrowTimeline(count: number): EscrowTimeline {
  const gap = count > 1 ? Math.min(ESCROW_STAGGER_MS, ESCROW_STAGGER_WINDOW_MS / (count - 1)) : 0;
  const starts = Array.from({ length: count }, (_, index) => Math.round(ESCROW_LEAD_MS + index * gap));
  const landings = starts.map((start) => start + ESCROW_TRAVEL_MS);
  const settleAt = count === 0 ? 0 : starts[count - 1]! + LANE_MS;
  return { starts, landings, settleAt, endsAt: settleAt + ESCROW_DROP_MS + ESCROW_SETTLE_MS };
}

/**
 * How far along its curve dollar number `index` is, 0 to 1, when its lane is `laneProgress` of
 * the way through LANE_MS. Later dollars wait their turn at 0 and earlier ones rest at 1.
 */
export function coinProgress(laneProgress: number, index: number): number {
  "worklet";
  const travelled = (laneProgress * LANE_MS - index * ESCROW_TRAIL_MS) / ESCROW_TRAVEL_MS;
  return Math.min(1, Math.max(0, travelled));
}

/** The share of the settle animation spent drawing the line; the payout box takes the rest. */
export const DROP_SHARE = ESCROW_DROP_MS / (ESCROW_DROP_MS + ESCROW_SETTLE_MS);
