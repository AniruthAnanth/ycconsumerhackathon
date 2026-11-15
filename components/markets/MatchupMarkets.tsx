import { Entrance } from "@/components/motion";
import { useCurrentLeague } from "@/lib/currentLeague";

import { hasLineups } from "./chartGeometry";
import { ProjectionCard } from "./ProjectionCard";
import { useMarket } from "./useMarket";
import { WinProbChart } from "./WinProbChart";

/** The Matchup tab's market block under the score hero: the win chance and its chart, then the projections. */
export function MatchupMarkets() {
  const { leagueId } = useCurrentLeague();
  const market = useMarket(leagueId);
  if (!market || !hasLineups([market.me, ...(market.matchup ? [market.matchup.opponent] : [])])) return null;
  return (
    <Entrance index={1}>
      {market.matchup ? <WinProbChart matchup={market.matchup} /> : null}
      <ProjectionCard market={market} />
    </Entrance>
  );
}
