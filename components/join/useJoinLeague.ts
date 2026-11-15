import { useRouter } from "expo-router";
import { useState } from "react";

import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentLeague } from "@/lib/currentLeague";

import { errorMessage } from "./errorMessage";

export type JoinSection = "quickMatch" | "inviteCode" | "create";

/**
 * Runs one of the three ways into a league. Whichever succeeds makes the league
 * current and moves on to the contacts step; while a call is in flight every
 * section is disabled, and a failure is shown only in the section that caused it.
 */
export function useJoinLeague() {
  const router = useRouter();
  const { setLeagueId } = useCurrentLeague();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ section: JoinSection; message: string } | null>(null);

  async function join(section: JoinSection, call: () => Promise<{ leagueId: Id<"leagues"> }>) {
    setBusy(true);
    setFailure(null);
    try {
      const { leagueId } = await call();
      setLeagueId(leagueId);
      router.replace({ pathname: "/contacts", params: { leagueId, next: "draft" } });
    } catch (error) {
      setFailure({ section, message: errorMessage(error) });
      setBusy(false);
    }
  }

  return { join, busy, failure };
}
