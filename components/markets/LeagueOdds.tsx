import { Entrance } from "@/components/motion";
import { useCurrentLeague } from "@/lib/currentLeague";

import { MarketsStrip } from "./MarketsStrip";
import { OddsList } from "./OddsList";
import { useMarket } from "./useMarket";

/** The League tab's markets: the question cards, then the pot board, above the standings table. */
export function LeagueOdds() {
  const { leagueId } = useCurrentLeague();
  const market = useMarket(leagueId);
  if (!market) return null;
  return (
    <Entrance index={1}>
      {market.odds.rows.some((row) => row.projected > 0) ? <MarketsStrip market={market} /> : null}
      <OddsList odds={market.odds} />
    </Entrance>
  );
}
