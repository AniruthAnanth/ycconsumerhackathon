import type { Drop } from "./backend";
import type { Matchup } from "@/components/social/contract";

/**
 * What the Live Activity draws, built from the same rows the Roster and Matchup screens read.
 *
 * The Swift side decodes this exact shape with JSONDecoder into a struct whose number fields
 * other than endsAtMs are Int, so every number here is rounded and every key is always
 * present. Change a key and ios/ and targets/widget change with it.
 */
export type LiveActivityState = {
  kind: "drop" | "matchup";
  leagueName: string;
  /** A drop's task, such as "20 push-ups". Empty for a matchup. */
  title: string;
  /** What the photo must show; empty when the drop has none. */
  gesture: string;
  /** What a drop pays. Zero for a matchup. */
  points: number;
  /** Epoch milliseconds: a drop's closesAt, or the end of the week. The system draws the countdown from it. */
  endsAtMs: number;
  /** First names, which read best in the Dynamic Island. Empty before the player has a matchup. */
  myName: string;
  opponentName: string;
  myScore: number;
  opponentScore: number;
  /** Of the five lineup slots, how many are verified. */
  slotsCleared: number;
  slotsTotal: number;
};

const SLOTS_TOTAL = 5;

/** Who is playing whom, so a drop's expanded island can still show the score. */
type MatchupContext = { leagueName: string; matchup: Matchup | null };

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** The scoreboard half of the state; zeros and empty names when the player has no matchup. */
function scoreboard(matchup: Matchup | null) {
  if (!matchup) {
    return { myName: "", opponentName: "", myScore: 0, opponentScore: 0, slotsCleared: 0, slotsTotal: SLOTS_TOTAL };
  }
  return {
    myName: firstName(matchup.me.name),
    opponentName: firstName(matchup.opponent.name),
    myScore: Math.round(matchup.me.total),
    opponentScore: Math.round(matchup.opponent.total),
    // The server's count, not one rebuilt from rows: a verified group session clears Body and People
    // from a flex row, which the rows alone would miss.
    slotsCleared: matchup.me.slotsCleared,
    slotsTotal: SLOTS_TOTAL,
  };
}

export function dropState(drop: Drop, { leagueName, matchup }: MatchupContext): LiveActivityState {
  return {
    kind: "drop",
    leagueName,
    title: drop.title,
    gesture: drop.gesture ?? "",
    points: Math.round(drop.points),
    endsAtMs: Math.round(drop.closesAt),
    ...scoreboard(matchup),
  };
}

export function matchupState(
  matchup: Matchup,
  { leagueName, weekEndsAtMs }: { leagueName: string; weekEndsAtMs: number },
): LiveActivityState {
  return {
    kind: "matchup",
    leagueName,
    title: "",
    gesture: "",
    points: 0,
    endsAtMs: Math.round(weekEndsAtMs),
    ...scoreboard(matchup),
  };
}

/**
 * The one state to show right now, or null when there is nothing worth a lock-screen slot.
 *
 * A quick-time drop that can still be submitted wins, the soonest to close first, because
 * its countdown is the thing the player can act on. drops.active lists a quick-time drop only
 * until the player's task is verified or the drop closes, so listed and not yet closed by our
 * clock is the whole test. Otherwise the week's matchup.
 */
export function activityFor({
  drops,
  matchup,
  leagueName,
  weekEndsAtMs,
  now,
}: {
  drops: Drop[];
  matchup: Matchup | null;
  leagueName: string;
  weekEndsAtMs: number;
  now: number;
}): LiveActivityState | null {
  const live = drops
    .filter((drop) => drop.kind === "quicktime" && drop.closesAt > now)
    .sort((a, b) => a.closesAt - b.closesAt)[0];
  if (live) return dropState(live, { leagueName, matchup });
  if (matchup) return matchupState(matchup, { leagueName, weekEndsAtMs });
  return null;
}
