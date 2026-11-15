import { formatUsd } from "@/lib/leagueText";

import type { Versus } from "./api";

/** The text the challenger sends. The link opens app/versus/join, which joins with the code. */
export function inviteMessage(inviteCode: string, link: string): string {
  return `I challenge you to a Lineup week. Code ${inviteCode} ${link}`;
}

/** "$10 pot, $5 each", or what a free versus is played for. */
export function potLine({ stakeUsd, potUsd }: Pick<Versus, "stakeUsd" | "potUsd">): string {
  if (stakeUsd === 0) return "Free, for bragging rights";
  return `${formatUsd(potUsd)} pot, ${formatUsd(stakeUsd)} each`;
}

/**
 * The settled result from my side. The payout list is the truth for money: it
 * already has the 10% fee taken off and the stake refunded to a loser who
 * filled all five slots, so the app never redoes that arithmetic.
 */
export function outcomeLine(versus: Pick<Versus, "me" | "stakeUsd" | "result">): { title: string; detail?: string } | null {
  const { result, me, stakeUsd } = versus;
  if (!result) return null;
  const mine = result.payouts.find((payout) => payout.userId === me.userId)?.amountUsd ?? 0;
  if (result.winnerId === null) {
    return { title: "It's a tie", detail: mine > 0 ? `${formatUsd(mine)} back to you` : undefined };
  }
  if (result.winnerId === me.userId) {
    return { title: stakeUsd > 0 && mine > 0 ? `You won ${formatUsd(mine)}` : "You won" };
  }
  if (stakeUsd === 0) return { title: "You lost" };
  return { title: "You lost", detail: mine > 0 ? `Full lineup: your ${formatUsd(mine)} comes back` : `Your ${formatUsd(stakeUsd)} stake is gone` };
}
