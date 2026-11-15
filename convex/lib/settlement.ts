/**
 * Settlement maths for one league week (SPEC.md section 2), as pure functions.
 *
 * The rule a player remembers: clear your five and you keep your money; score the
 * most and you take everyone else's.
 *
 *   - A finisher (cleared all five slots) gets their stake back, plus a share of the
 *     non-finishers' stakes in proportion to their points among finishers.
 *   - The platform keeps 10% of the non-finishers' stakes, and nothing else.
 *   - If nobody finishes, every stake is refunded in full and no fee is taken.
 *   - A free league has no pot, so there is nothing to move.
 *
 * Amounts are whole cents throughout. Splitting dollars as floats would invent or
 * lose a cent on shares like a third of $4.50, and the ledger must sum to the pot.
 */

/** The platform's cut of forfeited stakes. Returned stakes are never charged. */
export const PLATFORM_FEE_RATE = 0.1;

export type Entrant<UserId> = {
  userId: UserId;
  /** Paid the buy-in. Unpaid members play, but put nothing in and take nothing out. */
  paid: boolean;
  /** Cleared all five roster slots this week. */
  finished: boolean;
  /** Week points. Only a finisher's points matter: they set the share of winnings. */
  points: number;
};

export type Payout<UserId> = {
  userId: UserId;
  /** The member's own stake coming back. */
  refundCents: number;
  /** Their share of the non-finishers' stakes, after the fee. */
  winningsCents: number;
};

export type Settlement<UserId> = {
  /** Everything paid in: stake x paid members. */
  potCents: number;
  feeCents: number;
  /** One entry per member who receives money, in the order they were given. */
  payouts: Payout<UserId>[];
};

export function computeSettlement<UserId>(
  stakeUsd: number,
  entrants: Entrant<UserId>[],
): Settlement<UserId> {
  const stakeCents = Math.round(stakeUsd * 100);
  const paid = entrants.filter((entrant) => entrant.paid);
  const potCents = stakeCents * paid.length;
  if (potCents === 0) return { potCents: 0, feeCents: 0, payouts: [] };

  const finishers = paid.filter((entrant) => entrant.finished);
  if (finishers.length === 0) {
    return {
      potCents,
      feeCents: 0,
      payouts: paid.map(({ userId }) => ({ userId, refundCents: stakeCents, winningsCents: 0 })),
    };
  }

  const forfeitedCents = stakeCents * (paid.length - finishers.length);
  const feeCents = Math.round(forfeitedCents * PLATFORM_FEE_RATE);
  const shares = splitByWeight(
    forfeitedCents - feeCents,
    finishers.map((finisher) => finisher.points),
  );
  return {
    potCents,
    feeCents,
    payouts: finishers.map(({ userId }, i) => ({
      userId,
      refundCents: stakeCents,
      winningsCents: shares[i],
    })),
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
  kind: "refund" | "winnings" | "fee";
  amountUsd: number;
  /** Unique per row, so writing the same settlement twice inserts nothing new. */
  idempotencyKey: string;
};

/**
 * The ledger rows a settlement produces: a refund and (when non-zero) a winnings
 * row per paid-out member, and one fee row. Their amounts sum to the pot.
 *
 * `scope` names what is being settled, a week id or a league's season, and
 * prefixes every key, so each member has at most one refund and one winnings row in it.
 */
export function settlementLedgerRows<UserId extends string>(
  scope: string,
  settlement: Settlement<UserId>,
): SettlementLedgerRow<UserId>[] {
  const rows: SettlementLedgerRow<UserId>[] = [];
  for (const { userId, refundCents, winningsCents } of settlement.payouts) {
    rows.push({
      userId,
      kind: "refund",
      amountUsd: refundCents / 100,
      idempotencyKey: `${scope}:${userId}:refund`,
    });
    if (winningsCents > 0) {
      rows.push({
        userId,
        kind: "winnings",
        amountUsd: winningsCents / 100,
        idempotencyKey: `${scope}:${userId}:winnings`,
      });
    }
  }
  if (settlement.feeCents > 0) {
    rows.push({
      kind: "fee",
      amountUsd: settlement.feeCents / 100,
      idempotencyKey: `${scope}:fee`,
    });
  }
  return rows;
}
