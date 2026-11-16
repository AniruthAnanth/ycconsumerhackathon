import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";

import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { errorMessage } from "@/lib/errorMessage";

export type JoinSection = "quickMatch" | "inviteCode" | "create";

/**
 * Runs one of the three ways into a league. Whichever succeeds makes the league
 * current and moves on to the contacts step; while a call is in flight every
 * section is disabled, and a failure is shown only in the section that caused it.
 */
export function useJoinLeague() {
  const router = useRouter();
  const { setLeagueId } = useCurrentLeague();
  // The player's own current week; it is the same in every league they are in.
  const week = useQuery(backend.lineup.roster, {});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ section: JoinSection; message: string } | null>(null);

  async function join(section: JoinSection, call: () => Promise<{ leagueId: Id<"leagues"> }>) {
    setBusy(true);
    setFailure(null);
    try {
      const { leagueId } = await call();
      setLeagueId(leagueId);
      // One lineup per week scores in every league, so a player whose week is
      // already locked has nothing to draft for the league they just joined and
      // goes to Roster after the contacts step. A week that has not loaded yet
      // counts as unlocked: Voice Draft copes with a locked week, whereas Roster
      // would hide the draft from a new player.
      const next = week?.locked ? "roster" : "draft";
      // `created` tells Add Friends whether to say the league is ready or that the player is in it.
      router.replace({ pathname: "/contacts", params: { leagueId, next, ...(section === "create" ? { created: "1" } : {}) } });
    } catch (error) {
      setFailure({ section, message: errorMessage(error) });
      setBusy(false);
    }
  }

  return { join, busy, failure, clearFailure: () => setFailure(null) };
}
