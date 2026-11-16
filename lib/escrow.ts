import type { Payout, Pot, Standing } from "@/lib/backend";
import { formatUsd, isSettled } from "@/lib/leagueText";

/** One league member as the escrow diagram draws them. */
export type EscrowMember = { userId: string; name: string; avatarUrl?: string; paid: boolean };

/** The diagram's lower box. amountUsd is left out when the label says it all. */
export type EscrowPayout = { label: string; amountUsd?: number };

export type EscrowData = { members: EscrowMember[]; stakeUsd: number; potUsd: number; payout: EscrowPayout };

const roundCents = (usd: number) => Math.round(usd * 100) / 100;

/** What each top performer was credited: the largest share, since shares differ by a cent at most. */
export function shareEachUsd(payouts: readonly Pick<Payout, "userId" | "amountUsd">[]): number {
  const totals = new Map<string, number>();
  for (const payout of payouts) totals.set(payout.userId, (totals.get(payout.userId) ?? 0) + payout.amountUsd);
  return roundCents(Math.max(0, ...totals.values()));
}

/**
 * What the lower box reads. While the week is open the pot is split among its top finishers,
 * the members tied for the most slots cleared; the box names the rule and leaves the figure to
 * the pot above it. Once the week settles, each share sits in the league's escrow until the
 * league cashes out, and a week nobody won rolls its pot into the next.
 */
export function escrowPayout(pot: Pick<Pot, "settlesAt" | "payouts">, now: number): EscrowPayout {
  if (!isSettled(pot, now)) return { label: "Split among top finishers" };
  // The week's clock has run out but the settlement has not written its rows yet.
  if (pot.payouts === undefined) return { label: "Settling up" };
  const each = shareEachUsd(pot.payouts);
  return each > 0 ? { label: `In escrow: ${formatUsd(each)} each` } : { label: "Rolls into next week" };
}

/**
 * The pot's members with their pictures from the standings, in name order. The pot's own lists
 * decide who has paid, so the avatars and the total can never disagree, and the fixed order keeps
 * a member in the same place in the diagram when they pay or when the standings reorder.
 */
export function escrowMembers(pot: Pick<Pot, "paid" | "unpaid">, standings: readonly Pick<Standing, "userId" | "avatarUrl">[]): EscrowMember[] {
  const avatarOf = new Map<string, string | undefined>(standings.map((row) => [row.userId, row.avatarUrl]));
  const member = (person: { userId: string; name: string }, paid: boolean): EscrowMember => {
    const avatarUrl = avatarOf.get(person.userId);
    return { userId: person.userId, name: person.name, paid, ...(avatarUrl !== undefined && { avatarUrl }) };
  };
  return [...pot.paid.map((person) => member(person, true)), ...pot.unpaid.map((person) => member(person, false))].sort(
    (a, b) => compare(a.name, b.name) || compare(a.userId, b.userId),
  );
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Everything EscrowFlow needs, from what the League tab already loads. */
export function escrowFlowData(pot: Pot, standings: readonly Standing[], now: number): EscrowData {
  return { members: escrowMembers(pot, standings), stakeUsd: pot.stakeUsd, potUsd: pot.potUsd, payout: escrowPayout(pot, now) };
}
