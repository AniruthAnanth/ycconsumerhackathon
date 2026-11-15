import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { StyleSheet, View } from "react-native";

import { SeasonLink } from "@/components/league/SeasonLink";
import { LeaderboardsStrip } from "@/components/leaderboards";
import { LeagueDetails } from "@/components/leagueTab/LeagueDetails";
import { PayoutRows } from "@/components/leagueTab/PayoutRows";
import { PotSummary } from "@/components/leagueTab/PotSummary";
import { StandingsTable } from "@/components/leagueTab/StandingsTable";
import { NotificationSettings } from "@/components/notifications/NotificationSettings";
import { PayBanner } from "@/components/roster/PayBanner";
import { useNow } from "@/lib/useNow";
import { OutlinedPillButton, Screen } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { spacing } from "@/theme";

export { TabError as ErrorBoundary } from "@/components/social/RouteError";

/** LEAGUE: the pot, the standings table, payouts once settled, and the invite code. */
export default function LeagueScreen() {
  const router = useRouter();
  const { me, leagueId, membership } = useCurrentLeague();
  const now = useNow(60_000);
  const args = leagueId ? { leagueId } : "skip";
  const pot = useQuery(backend.standings.pot, args);
  const table = useQuery(backend.standings.table, args);
  const league = useQuery(backend.leagues.get, args);

  const owesBuyIn = membership !== undefined && !membership.paid && membership.stakeUsd > 0;

  if (!leagueId || !pot || !table || !league || !me) return <Screen edges={["bottom"]}>{null}</Screen>;

  return (
    <Screen edges={["bottom"]} scroll>
      {owesBuyIn ? <PayBanner leagueId={leagueId} stakeUsd={membership.stakeUsd} /> : null}
      <PotSummary pot={pot} now={now} />
      <LeaderboardsStrip leagueId={leagueId} />
      <StandingsTable
        rows={table}
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
  actions: { padding: spacing.lg },
});
