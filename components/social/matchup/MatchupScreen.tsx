import { useQuery } from "convex/react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { InviteButton } from "@/components/invite";
import { useTabBarInset } from "@/components/ui";
import { MatchupMarkets } from "@/components/markets";
import { ChallengeButton } from "@/components/versus/ChallengeButton";
import { VersusMatchup } from "@/components/versus/VersusMatchup";
import { api } from "@/convex/_generated/api";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing, type } from "@/theme";

import { socialApi } from "../contract";
import { ScreenState } from "../ScreenState";
import { boardByTask } from "../veto/vetoLogic";
import { MatchupBody } from "./MatchupBody";
import { MatchupTicker } from "./MatchupTicker";

export default function MatchupScreen() {
  const { leagueId, league, weekStart } = useCurrentLeague();
  const bottomInset = useTabBarInset();
  // standings.matchup takes no week, so it only ever answers for the current one; weekStart is set once the header steps away from it.
  const otherWeek = weekStart !== undefined;
  const matchup = useQuery(socialApi.standings.matchup, leagueId && !otherWeek ? { leagueId } : "skip");
  const board = useQuery(socialApi.vetoes.board, leagueId && !otherWeek ? { leagueId } : "skip");
  const versus = useQuery(api.versus.get, leagueId ? { leagueId } : "skip");

  if (otherWeek) return <ScreenState message={`Matchups are only shown for the current week (Week ${league?.week.number}).`} />;
  // A versus has its own matchup view: the pot on top, and something to show before the friend accepts.
  if (versus) return <VersusMatchup versus={versus} />;
  if (matchup === undefined || versus === undefined) return <ScreenState loading />;
  if (matchup === null)
    return (
      // One centred block, so the Invite button sits under the explanation instead of below the fold.
      <View style={[styles.empty, { paddingBottom: bottomInset }]}>
        <Text style={styles.emptyTitle}>No matchup yet</Text>
        <Text style={styles.emptyText}>You'll face a friend each week once someone joins your league.</Text>
        <InviteButton leagueId={leagueId} label="Invite a friend" variant="outlined" />
      </View>
    );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + spacing.xl }} scrollIndicatorInsets={{ bottom: bottomInset }}>
      {leagueId ? <MatchupTicker leagueId={leagueId} /> : null}
      <MatchupBody
        matchup={matchup}
        belowHero={<MatchupMarkets />}
        vetoes={leagueId ? { byTask: boardByTask(board), leagueId } : undefined}
      />
      <ChallengeButton />
      <View style={styles.invite}>
        <InviteButton leagueId={leagueId} label="Invite a friend" variant="outlined" />
      </View>
    </ScrollView>
  );
}

// The same inset as Challenge a friend above it, so the two secondary buttons share one width.
const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: SCREEN_MARGIN },
  invite: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: spacing.md },
  emptyTitle: { color: colors.text, fontFamily: fontFamily.bold, fontSize: font.title },
  emptyText: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.body, lineHeight: type.body.lineHeight, textAlign: "center" },
});
