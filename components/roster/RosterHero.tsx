import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Artwork } from "@/components/art";
import { CountUp, PressScale, ProgressFill } from "@/components/motion";
import { socialApi } from "@/components/social/contract";
import { formatScore } from "@/components/ui";
import type { Roster } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { formatCountdown } from "@/lib/leagueText";
import { useNow } from "@/lib/useNow";
import { planProgress, planProgressLabel } from "@/lib/weeklyPlan";
import { colors, fontFamily, hairline, radius, SCREEN_MARGIN, spacing, type } from "@/theme";

/**
 * The top of Roster, laid out like a fantasy app's matchup card: the head-to-head score is the
 * biggest thing on the screen, the win chance sits under it, then how much of the locked plan is
 * confirmed, and the league and week in small type above. Every number comes from the league,
 * the matchup and the roster rows; until they load the card says so rather than showing a 0.
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

  const plan = planProgress(roster.rows);
  const members = `${league.memberCount} ${league.memberCount === 1 ? "member" : "members"}`;
  const week = `Week ${weekNumber ?? league.week.number}`;
  const timing =
    weekStart === undefined && league.week.status === "open" ? ` · ends in ${formatCountdown(league.week.endsAt - now)}` : "";
  const chance = matchup ? Math.round(matchup.me.winProbability * 100) : null;
  const scoreboard = matchup
    ? `${matchup.me.name} ${formatScore(matchup.me.total)}, ${matchup.opponent.name} ${formatScore(matchup.opponent.total)}, ${chance}% to win`
    : `${formatScore(roster.total)} points this week`;

  return (
    <PressScale
      style={styles.card}
      onPress={() => router.navigate("/league")}
      accessibilityRole="button"
      accessibilityLabel={[`${league.name}, ${members}`, `${week}${timing}`, scoreboard].join(". ")}
      testID="roster-hero"
    >
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.league} numberOfLines={1}>
            {league.name} · {members}
          </Text>
          <Text style={styles.meta}>
            {week}
            {timing}
          </Text>
        </View>
        <Artwork name="sunny" size={78} />
      </View>

      {matchup ? (
        <View style={styles.scores}>
          <View style={styles.side}>
            <CountUp style={styles.myScore} value={matchup.me.total} format={formatScore} decimals={1} />
            <Text style={styles.name} numberOfLines={1}>
              {matchup.me.name}
            </Text>
          </View>
          <Text style={styles.vs}>vs</Text>
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
      {chance !== null ? (
        <View style={styles.chance}>
          <Text style={styles.chanceLabel}>{chance}% to win</Text>
          <ProgressFill ratio={chance / 100} height={6} />
        </View>
      ) : null}

      {plan.possible > 0 ? (
        <View
          style={styles.plan}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={planProgressLabel(plan)}
          accessibilityValue={{ min: 0, max: plan.possible, now: plan.confirmed }}
        >
          <Text style={styles.planLabel}>
            Your weekly plan · {plan.confirmed} / {plan.possible} pts
          </Text>
          <ProgressFill ratio={plan.ratio} />
          {plan.pending > 0 ? <Text style={styles.pending}>+{plan.pending} points pending review</Text> : null}
        </View>
      ) : null}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: SCREEN_MARGIN,
    marginBottom: spacing.md,
    padding: SCREEN_MARGIN,
    gap: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.divider,
  },
  loading: { minHeight: 160, alignItems: "center", justifyContent: "center" },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  league: { ...type.label, color: colors.text },
  meta: { ...type.small, fontFamily: fontFamily.semiBold, color: colors.textMuted },
  scores: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  side: { flex: 1 },
  sideEnd: { alignItems: "flex-end" },
  // The one number that matters most is the biggest type on the screen; the opponent's is a step down.
  myScore: { ...type.display, color: colors.text, fontVariant: ["tabular-nums"] },
  theirScore: { ...type.title, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  name: { ...type.small, fontFamily: fontFamily.semiBold, color: colors.textMuted },
  vs: { ...type.caption, color: colors.textFaint, paddingBottom: spacing.lg },
  chance: { gap: spacing.xs },
  chanceLabel: { ...type.caption, color: colors.accent },
  plan: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: hairline, borderTopColor: colors.divider },
  planLabel: { ...type.label, color: colors.text },
  pending: { ...type.small, color: colors.warning },
});
