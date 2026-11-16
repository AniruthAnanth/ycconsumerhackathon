import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { CountUp, PressScale } from "@/components/motion";
import { socialApi } from "@/components/social/contract";
import { formatScore } from "@/components/ui";
import type { Roster } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { formatCountdown } from "@/lib/leagueText";
import { useNow } from "@/lib/useNow";
import { BORDER, colors, fontFamily, layout, radius, SCREEN_MARGIN, spacing, type } from "@/theme";

/**
 * The top of Roster: the head-to-head score, compact, with the members and time left in small type above.
 * The win chance and the plan progress sit behind Week details further down, so the hero answers
 * one thing at a glance. Until the numbers load the card says so rather than showing a 0.
 * A tap opens the League tab.
 */
export function RosterHero({ roster }: { roster: Roster | undefined }) {
  const router = useRouter();
  const { leagueId, league, weekNumber, weekStart } = useCurrentLeague();
  const now = useNow(60_000);
  // standings.matchup only answers for the current week, so a browsed week shows only my total.
  const matchup = useQuery(socialApi.standings.matchup, leagueId && weekStart === undefined ? { leagueId } : "skip");

  if (!league || roster === undefined) {
    return (
      <View style={[styles.card, styles.loading]} testID="roster-hero-loading">
        <Text style={styles.meta}>Loading your week…</Text>
      </View>
    );
  }

  const members = `${league.memberCount} ${league.memberCount === 1 ? "member" : "members"}`;
  const week = `Week ${weekNumber ?? league.week.number}`;
  const timing =
    weekStart === undefined && league.week.status === "open" ? ` · ends in ${formatCountdown(league.week.endsAt - now)}` : "";
  const chance = matchup ? Math.round(matchup.me.winProbability * 100) : null;
  const scoreboard = matchup
    ? `${matchup.me.name} ${formatScore(matchup.me.total)}, ${matchup.opponent.name} ${formatScore(matchup.opponent.total)}, ${chance}% to win this matchup`
    : `${formatScore(roster.total)} points this week`;

  return (
    <PressScale
      style={styles.card}
      onPress={() => router.navigate("/league")}
      accessibilityRole="button"
      accessibilityLabel={[`${league.name}, ${members}`, `${week}${timing}`, scoreboard].join(". ")}
      testID="roster-hero"
    >
      {/* The header names the league and the week switcher the week, so the card adds only the members and the time left. */}
      <Text style={styles.meta} numberOfLines={1}>
        {members}
        {timing}
      </Text>

      {matchup ? (
        <View style={styles.scores}>
          <View style={styles.side}>
            <CountUp style={styles.myScore} value={matchup.me.total} format={formatScore} decimals={1} />
            <Text style={styles.name} numberOfLines={1}>
              You
            </Text>
          </View>
          <View style={[styles.side, styles.sideEnd]}>
            <CountUp style={styles.theirScore} value={matchup.opponent.total} format={formatScore} decimals={1} />
            <Text style={styles.name} numberOfLines={1}>
              {matchup.opponent.name}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.side}>
          <CountUp style={styles.myScore} value={roster.total} format={formatScore} decimals={1} />
          <Text style={styles.name}>points this week</Text>
        </View>
      )}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN_MARGIN,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: BORDER,
    borderColor: colors.divider,
  },
  loading: { minHeight: 120, alignItems: "center", justifyContent: "center" },
  meta: { ...type.small, fontFamily: fontFamily.semiBold, color: colors.textMuted },
  // Bottom-aligned so the two names under the scores share a baseline.
  scores: { flexDirection: "row", alignItems: "flex-end", gap: layout.columnGap },
  side: { flex: 1 },
  sideEnd: { alignItems: "flex-end" },
  // The one number that matters most is the biggest type on the screen; the opponent's is a step down.
  myScore: { ...type.display, color: colors.text, fontVariant: ["tabular-nums"] },
  theirScore: { ...type.title, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  name: { ...type.small, fontFamily: fontFamily.semiBold, color: colors.textMuted },
});
