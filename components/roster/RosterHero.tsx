import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Artwork } from "@/components/art";
import { socialApi } from "@/components/social/contract";
import type { Roster } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { formatCountdown } from "@/lib/leagueText";
import { useNow } from "@/lib/useNow";
import { planProgress, planProgressLabel } from "@/lib/weeklyPlan";
import { colors, fontFamily, hairline, progress, radius, SCREEN_MARGIN, spacing, type } from "@/theme";

/**
 * The top of Roster: which league and week this is, the head-to-head score, and how much of the
 * locked plan is confirmed. Every number comes from the league, the matchup and the roster rows;
 * until they load the card says so rather than showing a made-up 0. A tap opens the League tab.
 */
export function RosterHero({ roster }: { roster: Roster | undefined }) {
  const router = useRouter();
  const { leagueId, league, weekNumber, weekStart } = useCurrentLeague();
  const now = useNow(60_000);
  // standings.matchup only answers for the current week, so a browsed week shows no scoreboard.
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
  const timing =
    weekStart === undefined && league.week.status === "open" ? ` · ends in ${formatCountdown(league.week.endsAt - now)}` : "";
  const scoreboard = matchup ? `${matchup.me.name} ${matchup.me.total}, ${matchup.opponent.name} ${matchup.opponent.total}` : "";

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.navigate("/league")}
      accessibilityRole="button"
      accessibilityLabel={[`${league.name}, ${members}`, `Week ${weekNumber ?? league.week.number}${timing}`, scoreboard].filter(Boolean).join(". ")}
      testID="roster-hero"
    >
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.meta}>
            Week {weekNumber ?? league.week.number}
            {timing}
          </Text>
          <Text style={styles.league} numberOfLines={1}>
            {league.name}
          </Text>
          <Text style={styles.meta}>{members}</Text>
        </View>
        <Artwork name="sunny" size={78} />
      </View>

      {matchup ? (
        <View style={styles.scores}>
          <Side name={matchup.me.name} total={matchup.me.total} />
          <Text style={styles.vs}>vs</Text>
          <Side name={matchup.opponent.name} total={matchup.opponent.total} alignEnd />
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
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${plan.ratio * 100}%` }]} />
          </View>
          {plan.pending > 0 ? <Text style={styles.pending}>+{plan.pending} points pending review</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function Side({ name, total, alignEnd = false }: { name: string; total: number; alignEnd?: boolean }) {
  return (
    <View style={[styles.side, alignEnd && styles.sideEnd]}>
      <Text style={styles.score}>{total}</Text>
      <Text style={styles.meta} numberOfLines={1}>
        {name}
      </Text>
    </View>
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
  loading: { minHeight: 120, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.85 },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  league: { ...type.heading, color: colors.text },
  meta: { ...type.small, fontFamily: fontFamily.semiBold, color: colors.textMuted },
  scores: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  side: { flex: 1 },
  sideEnd: { alignItems: "flex-end" },
  score: { ...type.title, color: colors.text, fontVariant: ["tabular-nums"] },
  vs: { ...type.caption, color: colors.textFaint },
  plan: { gap: spacing.sm },
  planLabel: { ...type.label, color: colors.text },
  track: { height: progress.height, borderRadius: radius.pill, backgroundColor: progress.track, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill, backgroundColor: progress.fill },
  pending: { ...type.small, color: colors.warning },
});
