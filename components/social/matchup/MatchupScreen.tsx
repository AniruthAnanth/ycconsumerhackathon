import { useQuery } from "convex/react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { CoachTour } from "@/components/coach";
import { InviteButton } from "@/components/invite";
import { usePinnedTabBarInset, useTabBarInset } from "@/components/ui";
import { VersusMatchup } from "@/components/versus/VersusMatchup";
import { api } from "@/convex/_generated/api";
import { useCurrentLeague } from "@/lib/currentLeague";
import {
  colors,
  font,
  fontFamily,
  SCREEN_MARGIN,
  spacing,
  type,
} from "@/theme";

import { socialApi } from "../contract";
import { ScreenState } from "../ScreenState";
import { boardByTask } from "../veto/vetoLogic";
import { SunnyPrompt } from "../sunny/SunnyPrompt";
import { MatchupBody } from "./MatchupBody";
import { MatchupMore } from "./MatchupMore";
import { MatchupTicker } from "./MatchupTicker";

export default function MatchupScreen() {
  const { leagueId, league, weekStart } = useCurrentLeague();
  const bottomInset = useTabBarInset();
  const pinnedInset = usePinnedTabBarInset();
  // standings.matchup takes no week, so it only ever answers for the current one; weekStart is set once the header steps away from it.
  const otherWeek = weekStart !== undefined;
  const matchup = useQuery(
    socialApi.standings.matchup,
    leagueId && !otherWeek ? { leagueId } : "skip",
  );
  const board = useQuery(
    socialApi.vetoes.board,
    leagueId && !otherWeek ? { leagueId } : "skip",
  );
  const versus = useQuery(api.versus.get, leagueId ? { leagueId } : "skip");

  if (otherWeek)
    return (
      <ScreenState
        message={`Matchups are only shown for the current week (Week ${league?.week.number}).`}
      />
    );
  // A versus has its own matchup view: the pot on top, and something to show before the friend accepts.
  if (versus) return <VersusMatchup versus={versus} />;
  if (matchup === undefined || versus === undefined)
    return <ScreenState loading />;
  if (matchup === null)
    return (
      // One centred block, so the Invite button sits under the explanation instead of below the fold.
      <View style={[styles.empty, { paddingBottom: pinnedInset }]}>
        <Text style={styles.emptyTitle}>No matchup yet</Text>
        <Text style={styles.emptyText}>
          You'll face a friend each week once someone joins your league.
        </Text>
        <InviteButton
          leagueId={leagueId}
          label="Invite a friend"
          variant="outlined"
        />
      </View>
    );

  return (
    <CoachTour tour="matchup">
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomInset + spacing.xl }}
        scrollIndicatorInsets={{ bottom: bottomInset }}
      >
        {leagueId ? <MatchupTicker leagueId={leagueId} /> : null}
        <MatchupBody
          matchup={matchup}
          bonus={false}
          vetoes={
            leagueId ? { byTask: boardByTask(board), leagueId } : undefined
          }
        />
        <SunnyPrompt screen="matchup" />
        <MatchupMore matchup={matchup} leagueId={leagueId} />
      </ScrollView>
    </CoachTour>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: SCREEN_MARGIN,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: font.title,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: font.body,
    lineHeight: type.body.lineHeight,
    textAlign: "center",
  },
});
