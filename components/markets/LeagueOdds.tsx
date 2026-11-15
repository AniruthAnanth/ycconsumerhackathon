import { Entrance } from "@/components/motion";
import { useCurrentLeague } from "@/lib/currentLeague";

import { OddsList } from "./OddsList";
import { useMarket } from "./useMarket";

/** The League tab's odds board, mounted above the standings table. */
export function LeagueOdds() {
  const { leagueId } = useCurrentLeague();
  const market = useMarket(leagueId);
  if (!market) return null;
  return (
    <Entrance index={1}>
      <OddsList odds={market.odds} />
    </Entrance>
  );
}
