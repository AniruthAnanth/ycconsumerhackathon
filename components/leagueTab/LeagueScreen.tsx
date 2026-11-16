import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useMemo, type ReactNode } from "react";

import { CoachTarget, CoachTour } from "@/components/coach";
import { SeasonLink } from "@/components/league/SeasonLink";
import { ResetAndRestartRow } from "@/components/shell/ResetAndRestart";
import { LeaderboardsStrip } from "@/components/leaderboards";
import { LeagueDetails } from "@/components/leagueTab/LeagueDetails";
import { LeagueInfo } from "@/components/leagueTab/LeagueInfo";
import { PayoutRows } from "@/components/leagueTab/PayoutRows";
import { PotSummary } from "@/components/leagueTab/PotSummary";
import { StandingsTable } from "@/components/leagueTab/StandingsTable";
import { SunnyTextPrompt } from "@/components/social/sunny/SunnyPrompt";
import {
  bySeasonRank,
  playoffSpots,
  seasonRecords,
} from "@/components/leagueTab/seasonColumns";
import { NotificationSettings } from "@/components/notifications/NotificationSettings";
import { Entrance } from "@/components/motion";
import { useNow } from "@/lib/useNow";
import { Screen, useTabBarInset } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { backend, type Pot } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";

type Props = {
  /** Replaces the pot card. Mount point for <EscrowFlow/> (YCCO-7); defaults to PotSummary. */
  escrow?: (pot: Pot, now: number) => ReactNode;
  /** Rendered inside League info. Mount point for the markets odds (YCCO-30); nothing by default. */
  aboveStandings?: ReactNode;
};

/**
 * LEAGUE answers "where do I stand and what's the pot?": at most one banner, the pot, the standings
 * and payouts once settled. Everything else sits behind the League info row.
 */
export function LeagueScreen({ escrow, aboveStandings = null }: Props = {}) {
  const router = useRouter();
  const { me, leagueId } = useCurrentLeague();
  const now = useNow(60_000);
  const bottomInset = useTabBarInset();
  const args = leagueId ? { leagueId } : "skip";
  const pot = useQuery(backend.standings.pot, args);
  const table = useQuery(backend.standings.table, args);
  const league = useQuery(backend.leagues.get, args);
  const season = useQuery(api.seasons.overview, args);
  const records = useMemo(
    () => (season ? seasonRecords(season) : undefined),
    [season],
  );
  // One array per result: the table compares rows by identity to decide what flashes and slides.
  const seasonTable = useMemo(
    () => (table && records ? bySeasonRank(table, records) : undefined),
    [table, records],
  );

  // The season is waited for too, so the table first draws in season order instead of re-sorting.
  if (!leagueId || !pot || !seasonTable || !league || !me)
    return <Screen edges={[]}>{null}</Screen>;

  return (
    <CoachTour tour="league">
      <Screen edges={[]} scroll bottomInset={bottomInset}>
        <Entrance>
          <CoachTarget id="pot">
            {escrow ? (
              escrow(pot, now)
            ) : (
              <PotSummary pot={pot} standings={table} now={now} />
            )}
          </CoachTarget>
        </Entrance>
        <CoachTarget id="standings">
          <StandingsTable
            rows={seasonTable}
            records={records}
            playoffSpots={season ? playoffSpots(season) : null}
            viewerId={me._id}
            onPressPlayer={(userId) => router.push(`/profile/${userId}`)}
          />
        </CoachTarget>
        <SunnyTextPrompt />
        {pot.payouts?.length ? <PayoutRows payouts={pot.payouts} /> : null}
        <LeagueInfo>
          <LeagueDetails league={league} pot={pot} now={now} />
          <SeasonLink leagueId={leagueId} />
          <NotificationSettings />
          {aboveStandings}
          <LeaderboardsStrip leagueId={leagueId} />
        </LeagueInfo>
        {/* Builds for development and the demo only: one tap back to a brand-new player. */}
        {__DEV__ || process.env.EXPO_PUBLIC_DEV_FLAGS === "1" ? (
          <ResetAndRestartRow />
        ) : null}
      </Screen>
    </CoachTour>
  );
}
