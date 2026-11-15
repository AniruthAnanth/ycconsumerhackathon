import type { Stake } from "./stakes";

/** The four ways into a game, in the order the menu lists them. */
export const JOIN_MODES = [
  { key: "versus", label: "1v1 for a week", description: "Challenge one friend head to head for a week. No group needed.", action: "Challenge a friend" },
  { key: "quickMatch", label: "Quick match", description: "Get matched into an open league with strangers right now.", action: "Find a match" },
  { key: "code", label: "Join with a code", description: "Got an invite? Enter the code from your friend.", action: "Join league" },
  { key: "create", label: "Create a league", description: "Start your own league and invite friends. 4 quick steps.", action: "Start creating" },
] as const;

export type JoinMode = (typeof JOIN_MODES)[number]["key"];

/** Quick match, free: it asks nothing of a new player. */
export const DEFAULT_MODE: JoinMode = "quickMatch";

export function modeOf(key: JoinMode) {
  return JOIN_MODES.find((mode) => mode.key === key) ?? JOIN_MODES[1];
}

/** The line under the stake picker: what a buy-in means, or nothing for a free match. */
export function stakeLine(stakeUsd: Stake): string | null {
  return stakeUsd > 0 ? "Everyone pays in, winner takes the pot." : null;
}
