import { useQuery } from "convex/react";
import { useSyncExternalStore } from "react";

import { useCurrentLeague } from "@/lib/currentLeague";
import { useNow } from "@/lib/useNow";

import { socialApi } from "../contract";
import { sunnyBrief } from "./sunnyLogic";

/**
 * What Sunny last showed the player in each league, for the header's unread dot. In memory on
 * purpose: a fresh launch counts as something new, and opening the chat marks it read.
 */
const seen = new Map<string, string>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function markSunnySeen(leagueId: string, line: string) {
  if (seen.get(leagueId) === line) return;
  seen.set(leagueId, line);
  listeners.forEach((listener) => listener());
}

/** Sunny's brief for the current league and week, and whether the player has seen it yet. */
export function useSunny() {
  const { leagueId, league, weekStart } = useCurrentLeague();
  const now = useNow(60_000);
  const matchup = useQuery(socialApi.standings.matchup, leagueId && weekStart === undefined ? { leagueId } : "skip");
  const brief = sunnyBrief(matchup, league?.week, now);
  const seenLine = useSyncExternalStore(subscribe, () => (leagueId ? seen.get(leagueId) : undefined));
  return { leagueId, brief, unread: brief !== null && seenLine !== brief.line };
}
