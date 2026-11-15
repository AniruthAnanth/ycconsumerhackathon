import { useQuery } from "convex/react";
import { useEffect, useState } from "react";

import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import * as homeWidget from "@/lib/homeWidget";
import { widgetSnapshot } from "@/lib/widgetSnapshot";

/**
 * Keeps the home-screen widget in step with the standings table and my roster, the same two
 * live queries the League and Roster screens read, so the widget is right the moment the
 * player leaves the app.
 *
 * Renders nothing. Where the widget can't exist (Expo Go, Android, the web) both queries are
 * skipped and the component costs nothing.
 */
export function HomeWidgetSync({ leagueId }: { leagueId: Id<"leagues"> | null | undefined }) {
  const [available] = useState(homeWidget.isAvailable);
  const args = available && leagueId ? { leagueId } : "skip";
  const table = useQuery(backend.standings.table, args);
  const roster = useQuery(backend.lineup.roster, args);
  // Already loaded by the provider: who I am (the seeded player, under Switch Player) and my leagues' names.
  const { me } = useCurrentLeague();

  const leagueName = me?.leagues.find((league) => league._id === leagueId)?.name;
  // Null while anything is loading and when I am not in the league. Nothing is written then,
  // so the widget keeps its last scoreboard instead of blanking on every cold start.
  const snapshot =
    table && roster && me && leagueName !== undefined
      ? widgetSnapshot({ leagueName, table, meId: me._id, roster: roster.rows })
      : null;

  useEffect(() => {
    if (snapshot === null) return;
    void homeWidget.setSnapshot(snapshot);
  }, [JSON.stringify(snapshot)]);

  return null;
}
