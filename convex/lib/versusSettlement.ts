/**
 * Settlement maths for a 1v1 versus week, as a pure function.
 *
 * A versus is a two-member league (convex/versus.ts), so it settles through the same ledger as
 * any league, but the rule a player remembers is a head-to-head one: the higher score takes
 * both stakes, less the platform's 10% of the loser's stake (the league fee on a forfeited stake). Clearing all five slots still keeps your money, the
 * league rule "clear your five and you keep your money", so a loser who finished is refunded
 * and nothing changes hands. A tie refunds both, and so does anything short of two paid players:
 * an unpaid player can't win a pot, and a lone stake has nobody to lose to.
 *
 * It returns the league settlement's own shape, so settlementLedgerRows writes its rows.
 */
import { PLATFORM_FEE_RATE, type Entrant, type Settlement } from "./settlement";

export function computeVersusSettlement<UserId>(
  stakeUsd: number,
  entrants: Entrant<UserId>[],
): Settlement<UserId> {
  const stakeCents = Math.round(stakeUsd * 100);
  const paid = entrants.filter((entrant) => entrant.paid);
  const potCents = stakeCents * paid.length;
  if (potCents === 0) return { potCents: 0, feeCents: 0, payouts: [] };

  const refundEveryone: Settlement<UserId> = {
    potCents,
    feeCents: 0,
    payouts: paid.map(({ userId }) => ({
      userId,
      refundCents: stakeCents,
      winningsCents: 0,
    })),
  };
  if (entrants.length !== 2 || paid.length !== 2) return refundEveryone;

  const [winner, loser] = [...paid].sort((a, b) => b.points - a.points);
  if (winner.points === loser.points || loser.finished) return refundEveryone;

  const feeCents = Math.round(stakeCents * PLATFORM_FEE_RATE);
  return {
    potCents,
    feeCents,
    payouts: [
      {
        userId: winner.userId,
        refundCents: stakeCents,
        winningsCents: stakeCents - feeCents,
      },
    ],
  };
}
