import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { SeasonLink } from "@/components/league/SeasonLink";
import { LeaderboardsStrip } from "@/components/leaderboards";
import { LeagueDetails } from "@/components/leagueTab/LeagueDetails";
import { PayoutRows } from "@/components/leagueTab/PayoutRows";
import { PotSummary } from "@/components/leagueTab/PotSummary";
import { StandingsTable } from "@/components/leagueTab/StandingsTable";
import { NotificationSettings } from "@/components/notifications/NotificationSettings";
import { Entrance } from "@/components/motion";
import { PayBanner } from "@/components/roster/PayBanner";
import { useNow } from "@/lib/useNow";
import { OutlinedPillButton, Screen } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { backend, type Pot } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { SCREEN_MARGIN, spacing } from "@/theme";

type Props = {
  /** Replaces the pot card. Mount point for <EscrowFlow/> (YCCO-7); defaults to PotSummary. */
  escrow?: (pot: Pot, now: number) => ReactNode;
  /** Rendered directly above the standings table. Mount point for the markets odds (YCCO-30); nothing by default. */
  aboveStandings?: ReactNode;
};

/** LEAGUE: the pot, the standings table, payouts once settled, and the invite code. */
export function LeagueScreen({ escrow, aboveStandings = null }: Props = {}) {
  const router = useRouter();
  const { me, leagueId, membership } = useCurrentLeague();
  const now = useNow(60_000);
  const args = leagueId ? { leagueId } : "skip";
  const pot = useQuery(backend.standings.pot, args);
  const table = useQuery(backend.standings.table, args);
  const league = useQuery(backend.leagues.get, args);
  const season = useQuery(api.seasons.overview, args);
  const records = useMemo(() => new Map(season?.table.map((row) => [row.userId, row])), [season]);

  const owesBuyIn = membership !== undefined && !membership.paid && membership.stakeUsd > 0;

  if (!leagueId || !pot || !table || !league || !me) return <Screen edges={["bottom"]}>{null}</Screen>;

  return (
    <Screen edges={["bottom"]} scroll>
      {owesBuyIn ? <PayBanner leagueId={leagueId} stakeUsd={membership.stakeUsd} /> : null}
      <Entrance>{escrow ? escrow(pot, now) : <PotSummary pot={pot} standings={table} now={now} />}</Entrance>
      <Entrance index={1}>
        <LeaderboardsStrip leagueId={leagueId} />
      </Entrance>
      {aboveStandings}
      <StandingsTable
        rows={table}
        records={records}
        viewerId={me._id}
        onPressPlayer={(userId) => router.push(`/profile/${userId}`)}
      />
      <SeasonLink leagueId={leagueId} />
      {pot.payouts?.length ? <PayoutRows payouts={pot.payouts} /> : null}
      <NotificationSettings />
      <LeagueDetails league={league} pot={pot} now={now} />
      <View style={styles.actions}>
        <OutlinedPillButton
          label="Add friends from contacts"
          onPress={() => router.push({ pathname: "/contacts", params: { leagueId } })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.lg },
});
