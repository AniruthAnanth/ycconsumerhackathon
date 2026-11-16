import { PAYOUT_RULE } from "@/lib/payoutRule";

import type { Stake } from "./stakes";

/** The four ways into a game, in the order the menu lists them. */
export const JOIN_MODES = [
  { key: "versus", label: "1v1 for a week", description: "No group needed.", action: "Challenge a friend" },
  { key: "quickMatch", label: "Quick match", description: "Play strangers in an open league, starting now.", action: "Find a match" },
  { key: "code", label: "Join with a code", description: "Got an invite? Type what your friend sent you.", action: "Join league" },
  { key: "create", label: "Create a league", description: "Your own league, with the friends you invite.", action: "Start creating" },
] as const;

export type JoinMode = (typeof JOIN_MODES)[number]["key"];

/** Quick match, free: it asks nothing of a new player. */
export const DEFAULT_MODE: JoinMode = "quickMatch";

export function modeOf(key: JoinMode) {
  return JOIN_MODES.find((mode) => mode.key === key) ?? JOIN_MODES[1];
}

/** A mode named in a link (?mode=code), or null for anything else. */
export function parseMode(value: string | undefined): JoinMode | null {
  return JOIN_MODES.find((mode) => mode.key === value)?.key ?? null;
}

/** What the Create walkthrough will ask, shown before it opens. */
export const CREATE_PREVIEW = ["Name your league", "Who's playing", "Set the buy-in", "Pick your season"] as const;

/** The line under the stake picker: the payout rule, or nothing for a free match. */
export function stakeLine(stakeUsd: Stake): string | null {
  return stakeUsd > 0 ? PAYOUT_RULE : null;
}
