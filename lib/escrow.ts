import { PLATFORM_FEE_RATE } from "@/convex/lib/settlement";
import type { Payout, Pot, Standing } from "@/lib/backend";
import { isSettled } from "@/lib/leagueText";

/** One league member as the escrow diagram draws them. */
export type EscrowMember = { userId: string; name: string; avatarUrl?: string; paid: boolean };

/** The diagram's lower box. amountUsd is left out when the label says it all ("No payout"). */
export type EscrowPayout = { label: string; amountUsd?: number };

export type EscrowData = { members: EscrowMember[]; stakeUsd: number; potUsd: number; payout: EscrowPayout };

const roundCents = (usd: number) => Math.round(usd * 100) / 100;

/**
 * The most one member can take from the pot: their own stake back plus every other stake less
 * the fee, which is what happens when they alone clear all five slots. With several finishers
 * each takes less, so the diagram labels it "up to".
 */
export function winnerTakesUsd(stakeUsd: number, potUsd: number): number {
  if (potUsd <= 0) return 0;
  return roundCents(stakeUsd + (1 - PLATFORM_FEE_RATE) * Math.max(0, potUsd - stakeUsd));
}

/** The largest total any one member received: a finisher gets a refund row and a winnings row. */
export function largestPayoutUsd(payouts: readonly Pick<Payout, "userId" | "amountUsd">[]): number {
  const totals = new Map<string, number>();
  for (const payout of payouts) totals.set(payout.userId, (totals.get(payout.userId) ?? 0) + payout.amountUsd);
  return roundCents(Math.max(0, ...totals.values()));
}

/** What the lower box reads: the prize while the week is open, what was really paid once it settles. */
export function escrowPayout(pot: Pick<Pot, "stakeUsd" | "potUsd" | "settlesAt" | "payouts">, now: number): EscrowPayout {
  if (!isSettled(pot, now)) return { label: "Winner takes up to", amountUsd: winnerTakesUsd(pot.stakeUsd, pot.potUsd) };
  // The week's clock has run out but the settlement has not written its payouts yet.
  if (pot.payouts === undefined) return { label: "Settling up" };
  const largest = largestPayoutUsd(pot.payouts);
  // "Paid out $0" would read as a payment that happened; nobody finishing pays nobody.
  return largest > 0 ? { label: "Paid out", amountUsd: largest } : { label: "No payout" };
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
