import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { StyleSheet, View } from "react-native";

import { LeagueDetails } from "@/components/leagueTab/LeagueDetails";
import { PayoutRows } from "@/components/leagueTab/PayoutRows";
import { PotSummary } from "@/components/leagueTab/PotSummary";
import { StandingsTable } from "@/components/leagueTab/StandingsTable";
import { TextLineupBanner } from "@/components/shell/TextLineupBanner";
import { useNow } from "@/lib/useNow";
import { OutlinedPillButton, Screen } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { spacing } from "@/theme";

export { TabError as ErrorBoundary } from "@/components/social/RouteError";

/** LEAGUE: the pot, the standings table, payouts once settled, and the invite code. */
export default function LeagueScreen() {
  const router = useRouter();
  const { leagueId } = useCurrentLeague();
  const now = useNow(60_000);
  const args = leagueId ? { leagueId } : "skip";
  const pot = useQuery(backend.standings.pot, args);
  const table = useQuery(backend.standings.table, args);
  const league = useQuery(backend.leagues.get, args);
  const me = useQuery(backend.users.me, leagueId ? {} : "skip");

  if (!leagueId || !pot || !table || !league || !me) return <Screen edges={["bottom"]}>{null}</Screen>;

  return (
    <Screen edges={["bottom"]} scroll>
      <PotSummary pot={pot} now={now} />
      <StandingsTable
        rows={table}
        viewerId={me.actingAs?._id ?? me._id}
        onPressPlayer={(userId) => router.push(`/profile/${userId}`)}
      />
      {pot.payouts ? <PayoutRows payouts={pot.payouts} /> : null}
      <TextLineupBanner />
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
