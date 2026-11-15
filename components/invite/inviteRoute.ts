import { formatUsd } from "@/lib/leagueText";

import type { InviteMode, RecruitedFriend, RecruiterSummary } from "./backend";

/**
 * Where a player lands after accepting an invite. A player who had no league
 * before has no lineup either, so they go straight to the draft; a player who
 * was already playing goes to the league (or the matchup, for a 1v1) they joined.
 */
export function routeAfterAccept({ hadLeagues, mode }: { hadLeagues: boolean; mode: InviteMode }) {
  if (!hadLeagues) return "/draft" as const;
  return mode === "versus" ? ("/(tabs)/matchup" as const) : ("/(tabs)/league" as const);
}

/** "$5 buy-in", or "Free" for a league with no stake. */
export function stakeLabel(stakeUsd: number): string {
  return stakeUsd > 0 ? `${formatUsd(stakeUsd)} buy-in` : "Free";
}

/** The line under the league name on the landing screen: "1v1 challenge · $5 buy-in · 4 players". */
export function inviteDetailLine({ mode, stakeUsd, memberCount }: { mode: InviteMode; stakeUsd: number; memberCount: number }) {
  const parts = [mode === "versus" ? "1v1 challenge" : null, stakeLabel(stakeUsd), `${memberCount} ${memberCount === 1 ? "player" : "players"}`];
  return parts.filter(Boolean).join(" · ");
}

/** The Profile pill: "RECRUITER · 3 friends · +75". Null when there is no badge, so nothing renders. */
export function recruiterPillText(summary: RecruiterSummary): string | null {
  if (!summary.badge) return null;
  const friends = `${summary.locked} ${summary.locked === 1 ? "friend" : "friends"}`;
  return `${summary.badge.toUpperCase()} · ${friends} · +${summary.recruiterPoints}`;
}

/** A recruited friend's status on the Recruiter card. */
export function friendStatusLine(friend: RecruitedFriend): string {
  return friend.status === "locked" ? `Locked a lineup +${friend.points}` : "Joined";
}
