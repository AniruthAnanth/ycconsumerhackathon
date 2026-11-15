import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";

import { errorMessage } from "@/components/join/errorMessage";
import { api } from "@/convex/_generated/api";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { haptics } from "@/lib/native/haptics";

import { routeAfterAccept } from "./inviteRoute";

/**
 * Everything the invite landing screen does: read the invite and the caller,
 * then (for a new player) save their name and phone, join through the link and
 * open the right screen with the joined league in the header.
 */
export function useAcceptInvite(token: string) {
  const router = useRouter();
  const { me, setLeagueId } = useCurrentLeague();
  const preview = useQuery(api.referrals.preview, token ? { token } : "skip");
  const createUser = useMutation(backend.users.createUser);
  const accept = useMutation(api.referrals.accept);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(profile?: { name: string; phone: string }) {
    if (saving) return;
    setSaving(true);
    setError(null);
    // Read before accepting: afterwards the caller is always in a league.
    const hadLeagues = (me?.leagues.length ?? 0) > 0;
    try {
      if (profile) await createUser(profile);
      const joined = await accept({ token });
      haptics.success();
      setLeagueId(joined.leagueId);
      router.replace(routeAfterAccept({ hadLeagues, mode: joined.mode }));
    } catch (failure) {
      haptics.error();
      setError(errorMessage(failure));
      setSaving(false);
    }
  }

  /** For the inviter themselves or a member already in: show that league. */
  function open() {
    if (!preview) return;
    setLeagueId(preview.leagueId);
    router.replace(routeAfterAccept({ hadLeagues: true, mode: preview.mode }));
  }

  return { me, preview, join, open, saving, error, clearError: () => setError(null) };
}
