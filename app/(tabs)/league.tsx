import { LeagueScreen } from "@/components/leagueTab/LeagueScreen";
import { LeagueOdds } from "@/components/markets";

export default function LeagueTab() {
  return <LeagueScreen aboveStandings={<LeagueOdds />} />;
}

export { TabError as ErrorBoundary } from "@/components/social/RouteError";
