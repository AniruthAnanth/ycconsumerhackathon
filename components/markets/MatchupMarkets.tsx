import { useQuery } from "convex/react";

import { Entrance } from "@/components/motion";
import { socialApi } from "@/components/social/contract";
import { useCurrentLeague } from "@/lib/currentLeague";

import { hasLineups } from "./chartGeometry";
import { ProjectionCard } from "./ProjectionCard";
import { useMarket } from "./useMarket";
import { WinProbChart } from "./WinProbChart";

/** The Matchup tab's market block under the score hero: the money at stake first, then how your chance moved. */
export function MatchupMarkets() {
  const { leagueId } = useCurrentLeague();
  const market = useMarket(leagueId);
  // The same subscription the hero already holds, so this costs no extra query.
  const matchup = useQuery(socialApi.standings.matchup, leagueId ? { leagueId } : "skip");
  if (!market || !hasLineups([market.me, ...(market.matchup ? [market.matchup.opponent] : [])])) return null;
  return (
    <Entrance index={1}>
      <ProjectionCard market={market} slotsCleared={matchup?.me.slotsCleared} />
      {market.matchup ? <WinProbChart matchup={market.matchup} /> : null}
    </Entrance>
  );
}
