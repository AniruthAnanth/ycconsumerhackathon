/**
 * Settlement maths for one league week, as pure functions (docs/SCORING.md).
 *
 * The rule a player remembers: clear the most slots and you share the pot.
 *
 *   - The pot is the stake times the paid members, plus whatever rolled over from earlier
 *     weeks nobody won.
 *   - It is split evenly among the paid members tied for the most slots cleared that week,
 *     even when that is fewer than five. If everyone clears all five, everyone splits it.
 *   - Unpaid members play but share nothing.
 *   - If no paid member cleared a slot, nobody wins and the whole pot rolls into next week.
 *   - A free league has no pot, so there is nothing to move.
 *
 * A share is credited to the member's escrow balance in the ledger. It is not sent anywhere
 * here: cashing out happens on the league's payout timeline (whop.ts).
 *
 * Amounts are whole cents throughout. Splitting dollars as floats would invent or
 * lose a cent on shares like a third of $4.50, and the ledger must sum to the pot.
 */

/**
 * The platform's cut. The current rule splits the whole pot, so it is not charged on league
 * settlements; a 1v1 versus still takes it from the loser's stake (versusSettlement.ts).
 */
export const PLATFORM_FEE_RATE = 0.1;

/** The most slots a week has. */
export const SLOTS_PER_WEEK = 5;

export type Entrant<UserId> = {
  userId: UserId;
  /** Paid the buy-in. Unpaid members play, but put nothing in and take nothing out. */
  paid: boolean;
  /** Cleared all five roster slots this week. */
  finished: boolean;
  /**
   * Slots cleared, 0 to 5: the top performers are the paid members tied for the most. Left
   * out, a finisher counts as five and anyone else as none.
   */
  slotsCleared?: number;
  /** Week points. Kept for the 1v1 versus rule, which pays the higher score. */
  points: number;
};

export type Payout<UserId> = {
  userId: UserId;
  /** The member's own stake coming back (only the 1v1 versus rule returns stakes). */
  refundCents: number;
  /** Their share of the pot, credited to escrow. */
  winningsCents: number;
};

export type Settlement<UserId> = {
  /** Everything paid in this week: stake x paid members. */
  potCents: number;
  feeCents: number;
  /** One entry per member who receives money, in the order they were given. */
  payouts: Payout<UserId>[];
  /** What nobody won and carries into next week's pot. */
  rolloverCents?: number;
  /** What earlier weeks rolled over and this settlement shared out. */
  carriedInCents?: number;
};

const slotsOf = <UserId>(entrant: Entrant<UserId>) =>
  entrant.slotsCleared ?? (entrant.finished ? SLOTS_PER_WEEK : 0);

/**
 * `carriedInCents` is what earlier weeks rolled over: it joins this week's pot when someone
 * wins it, and keeps waiting when nobody does.
 */
export function computeSettlement<UserId>(
  stakeUsd: number,
  entrants: Entrant<UserId>[],
  carriedInCents = 0,
): Settlement<UserId> {
  const stakeCents = Math.round(stakeUsd * 100);
  const paid = entrants.filter((entrant) => entrant.paid);
  const potCents = stakeCents * paid.length;
  if (potCents === 0 && carriedInCents === 0) return { potCents: 0, feeCents: 0, payouts: [] };

  const most = Math.max(0, ...paid.map(slotsOf));
  if (most === 0) return { potCents, feeCents: 0, payouts: [], rolloverCents: potCents };

  const top = paid.filter((entrant) => slotsOf(entrant) === most);
  const shares = splitByWeight(potCents + carriedInCents, top.map(() => 1));
  return {
    potCents,
    feeCents: 0,
    payouts: top.map(({ userId }, i) => ({ userId, refundCents: 0, winningsCents: shares[i] })),
    ...(carriedInCents > 0 && { carriedInCents }),
  };
}

/**
 * Splits `totalCents` in proportion to `weights` so the parts add up to the total
 * exactly (largest-remainder method): everyone gets their share rounded down, then
 * the leftover cents go one each to the largest fractions, earliest first on a tie.
 * Weights that are all zero or negative split evenly, so a pot is never stranded.
 */
export function splitByWeight(totalCents: number, weights: number[]): number[] {
  const positive = weights.map((weight) => Math.max(0, weight));
  const usable = positive.some((weight) => weight > 0) ? positive : weights.map(() => 1);
  const weightSum = usable.reduce((sum, weight) => sum + weight, 0);

  const exact = usable.map((weight) => (totalCents * weight) / weightSum);
  const shares = exact.map(Math.floor);
  const leftover = totalCents - shares.reduce((sum, share) => sum + share, 0);

  const byLargestFraction = exact
    .map((value, i) => ({ i, fraction: value - shares[i] }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  for (const { i } of byLargestFraction.slice(0, leftover)) shares[i] += 1;
  return shares;
}

export type SettlementLedgerRow<UserId> = {
  /** Absent on the fee row, which belongs to the platform. */
  userId?: UserId;
  kind: "refund" | "winnings" | "fee" | "rollover";
  amountUsd: number;
  /** Unique per row, so writing the same settlement twice inserts nothing new. */
  idempotencyKey: string;
};

/**
 * The ledger rows a settlement produces: a winnings row per member who shares the pot (their
 * escrow credit), a refund row where a stake comes back (1v1 versus only), a fee row when one
 * is charged, and rollover rows: positive for a pot nobody won, negative for an earlier
 * rollover this settlement shared out. Rollover rows summed over a league are what is still
 * waiting to be won.
 *
 * `scope` names what is being settled, a week id or a league's season, and prefixes every
 * key, so writing the same settlement twice inserts nothing new.
 */
export function settlementLedgerRows<UserId extends string>(
  scope: string,
  settlement: Settlement<UserId>,
): SettlementLedgerRow<UserId>[] {
  const rows: SettlementLedgerRow<UserId>[] = [];
  for (const { userId, refundCents, winningsCents } of settlement.payouts) {
    if (refundCents > 0) {
      rows.push({ userId, kind: "refund", amountUsd: refundCents / 100, idempotencyKey: `${scope}:${userId}:refund` });
    }
    if (winningsCents > 0) {
      rows.push({ userId, kind: "winnings", amountUsd: winningsCents / 100, idempotencyKey: `${scope}:${userId}:winnings` });
    }
  }
  if (settlement.feeCents > 0) {
    rows.push({ kind: "fee", amountUsd: settlement.feeCents / 100, idempotencyKey: `${scope}:fee` });
  }
  if (settlement.carriedInCents) {
    rows.push({ kind: "rollover", amountUsd: -settlement.carriedInCents / 100, idempotencyKey: `${scope}:rollover-in` });
  }
  if (settlement.rolloverCents) {
    rows.push({ kind: "rollover", amountUsd: settlement.rolloverCents / 100, idempotencyKey: `${scope}:rollover` });
  }
  return rows;
}
