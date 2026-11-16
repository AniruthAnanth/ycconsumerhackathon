import { Entrance } from "@/components/motion";
import { useCurrentLeague } from "@/lib/currentLeague";

import { hasLineups } from "./chartGeometry";
import { ProjectionCard } from "./ProjectionCard";
import { useMarket } from "./useMarket";
import { WinProbChart } from "./WinProbChart";

/** The Matchup tab's market block under the score hero: the money at stake first, then how your chance moved. */
export function MatchupMarkets() {
  const { leagueId } = useCurrentLeague();
  const market = useMarket(leagueId);
  if (!market || !hasLineups([market.me, ...(market.matchup ? [market.matchup.opponent] : [])])) return null;
  return (
    <Entrance index={1}>
      <ProjectionCard market={market} />
      {market.matchup ? <WinProbChart matchup={market.matchup} /> : null}
    </Entrance>
  );
}
