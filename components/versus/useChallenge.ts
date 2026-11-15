import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";

import { errorMessage } from "@/components/join/errorMessage";
import type { Stake } from "@/components/join/stakes";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentLeague } from "@/lib/currentLeague";

import { versusApi } from "./api";
import { shareInvite } from "./shareInvite";

/** Who to challenge. "link" creates the versus with an open seat and shares its code. */
export type Opponent =
  | { kind: "friend"; userId: Id<"users">; name: string }
  | { kind: "contact"; phone: string; name: string }
  | { kind: "link" };

/**
 * Creates the versus, invites the friend when the server could not seat them
 * directly (no account for that number, or a link), and opens the versus home.
 */
export function useChallenge() {
  const router = useRouter();
  const { setLeagueId } = useCurrentLeague();
  const challengeMutation = useMutation(versusApi.challenge);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function challenge(stakeUsd: Stake, opponent: Opponent) {
    setBusy(true);
    setFailure(null);
    try {
      const { leagueId, inviteCode, opponentName } = await challengeMutation({
        stakeUsd,
        opponentId: opponent.kind === "friend" ? opponent.userId : undefined,
        opponentPhone: opponent.kind === "contact" ? opponent.phone : undefined,
      });
      if (opponentName === null) await shareInvite(inviteCode, opponent.kind === "contact" ? opponent.phone : undefined);
      setLeagueId(leagueId);
      router.replace({ pathname: "/versus/[leagueId]", params: { leagueId } });
    } catch (error) {
      setFailure(errorMessage(error));
      setBusy(false);
    }
  }

  return { challenge, busy, failure };
}
