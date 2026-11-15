import { useQuery } from "convex/react";
import { useEffect, useState } from "react";

import { socialApi } from "@/components/social/contract";
import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import * as liveActivity from "@/lib/liveActivity";
import { activityFor } from "@/lib/liveActivityState";
import { useNow } from "@/lib/useNow";

/**
 * Keeps the Live Activity in step with the same two live queries the Roster and Matchup
 * screens read, so a proof verified on another phone moves the score on the lock screen.
 *
 * Renders nothing. Where Live Activities are unavailable (Expo Go, Android, the web, or the
 * player turned them off) every query is skipped and the component costs nothing.
 */
export function LiveActivitySync({ leagueId }: { leagueId: Id<"leagues"> | null | undefined }) {
  const [available] = useState(liveActivity.isAvailable);
  const args = available && leagueId ? { leagueId } : "skip";
  const drops = useQuery(backend.drops.active, args);
  const matchup = useQuery(socialApi.standings.matchup, args);
  const { league } = useCurrentLeague();
  // A coarse tick is enough: it only decides when a closed drop gives way to the matchup.
  const now = useNow(5000);

  // Until all three have loaded there is nothing to compare, and ending now would kill a
  // running activity on every cold start.
  const loaded = drops !== undefined && matchup !== undefined && league !== undefined;
  const state = loaded
    ? activityFor({ drops, matchup, leagueName: league.name, weekEndsAtMs: league.week.endsAt, now })
    : undefined;

  useEffect(() => {
    if (state === undefined) return;
    // Not ended on unmount: the activity stays on the lock screen after the player leaves the app.
    if (state === null) {
      void liveActivity.end();
    } else if (state.kind === "drop") {
      void liveActivity.startDrop(state);
    } else {
      void liveActivity.startMatchup(state);
    }
  }, [JSON.stringify(state)]);

  return null;
}
