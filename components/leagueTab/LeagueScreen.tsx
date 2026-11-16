import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { CoachTarget, CoachTour } from "@/components/coach";
import { SeasonLink } from "@/components/league/SeasonLink";
import { ResetAndRestartRow } from "@/components/shell/ResetAndRestart";
import { LeaderboardsStrip, placeText, tiedRanks } from "@/components/leaderboards";
import { LeagueDetails } from "@/components/leagueTab/LeagueDetails";
import { LeagueInfo } from "@/components/leagueTab/LeagueInfo";
import { PayoutRows } from "@/components/leagueTab/PayoutRows";
import { potEmptyText } from "@/components/leagueTab/emptyState";
import { PotSummary } from "@/components/leagueTab/PotSummary";
import { StandingsTable } from "@/components/leagueTab/StandingsTable";
import { SunnyTextPrompt } from "@/components/social/sunny/SunnyPrompt";
import {
  bySeasonRank,
  playoffSpots,
  seasonRecords,
} from "@/components/leagueTab/seasonColumns";
import { Entrance } from "@/components/motion";
import { useNow } from "@/lib/useNow";
import { Screen, SectionLabel, useTabBarInset } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { backend, type Pot } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { spacing } from "@/theme";

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

  const potCard = escrow ? escrow(pot, now) : <PotSummary pot={pot} standings={table} now={now} />;
  // No money in the pot yet: the section would hold one note and empty space, so the standings lead instead.
  const showPot = escrow !== undefined || potEmptyText(pot) === null;
  // YOUR RANK reads the same rows as the table, so the two can never disagree.
  const mine = seasonTable.find((row) => row.userId === me._id);
  const place = mine ? placeText(mine.rank, tiedRanks(seasonTable).has(mine.rank)) : undefined;

  return (
    <CoachTour tour="league">
      <Screen edges={[]} scroll bottomInset={bottomInset}>
        {showPot ? (
          <View style={styles.first}>
            <SectionLabel left="This week" />
            <Entrance>
              {/* A free league has no pot, so the tour's pot step finds no target and skips itself. */}
              {pot.stakeUsd > 0 ? <CoachTarget id="pot">{potCard}</CoachTarget> : potCard}
            </Entrance>
          </View>
        ) : null}
        <CoachTarget id="standings">
          <StandingsTable
            style={showPot ? styles.section : styles.first}
            rows={seasonTable}
            records={records}
            playoffSpots={season ? playoffSpots(season) : null}
            viewerId={me._id}
            onPressPlayer={(userId) => router.push(`/profile/${userId}`)}
          />
        </CoachTarget>
        <SunnyTextPrompt />
        {pot.payouts?.length ? (
          <View style={styles.section}>
            <PayoutRows payouts={pot.payouts} />
          </View>
        ) : null}
        <LeagueInfo style={styles.section}>
          <LeagueDetails league={league} pot={pot} now={now} />
          <SeasonLink leagueId={leagueId} />
          {aboveStandings}
          <LeaderboardsStrip leagueId={leagueId} place={place} />
        </LeagueInfo>
        {/* Builds for development and the demo only: one tap back to a brand-new player. */}
        {__DEV__ || process.env.EXPO_PUBLIC_DEV_FLAGS === "1" ? (
          <ResetAndRestartRow />
        ) : null}
      </Screen>
    </CoachTour>
  );
}

// One 32-pt gap between sections, each with its header on the canvas, so no block butts up against the last.
const styles = StyleSheet.create({
  first: { marginTop: spacing.lg },
  section: { marginTop: spacing.xxl },
});
