import { useQuery } from "convex/react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ProjectionLine } from "@/components/leaderboards";
import { MatchupOdds } from "@/components/markets/MatchupOdds";
import { PressScale, ProgressFill } from "@/components/motion";
import { RosterTotal } from "@/components/roster/RosterTotal";
import { socialApi } from "@/components/social/contract";
import { Icon } from "@/components/ui";
import type { Roster } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { planProgress, planProgressLabel } from "@/lib/weeklyPlan";
import { colors, hairline, layout, SCREEN_MARGIN, spacing, type } from "@/theme";

/**
 * Everything about the week that does not decide what to do next: the win chance, the weekly
 * plan's progress, the projection and the box-score total. Roster keeps them one tap away behind
 * a single chevron row, closed by default, so the lineup is the first thing the player reads.
 */
export function RosterWeekDetails({ roster }: { roster: Roster }) {
  const [open, setOpen] = useState(false);
  const { leagueId, weekStart } = useCurrentLeague();
  const matchup = useQuery(socialApi.standings.matchup, open && leagueId && weekStart === undefined ? { leagueId } : "skip");
  const plan = planProgress(roster.rows);

  return (
    <View>
      <PressScale
        style={styles.row}
        onPress={() => setOpen((was) => !was)}
        accessibilityRole="button"
        accessibilityLabel="Week details"
        accessibilityState={{ expanded: open }}
        testID="roster-week-details"
      >
        <Icon name="stats-chart-outline" size={20} color={colors.textMuted} />
        <Text style={styles.label}>Week details</Text>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textFaint} />
      </PressScale>
      {open ? (
        <View style={styles.body}>
          {matchup ? (
            <View style={styles.inset}>
              <MatchupOdds
                compact
                me={{ name: matchup.me.name, chance: matchup.me.winProbability }}
                them={{ name: matchup.opponent.name, chance: matchup.opponent.winProbability }}
              />
            </View>
          ) : null}
          {plan.possible > 0 ? (
            <View
              style={[styles.inset, styles.plan]}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={planProgressLabel(plan)}
              accessibilityValue={{ min: 0, max: plan.possible, now: plan.confirmed }}
            >
              <Text style={styles.meta}>
                Your weekly plan · {plan.confirmed} / {plan.possible} pts
              </Text>
              <ProgressFill ratio={plan.ratio} />
              {plan.pending > 0 ? <Text style={styles.meta}>+{plan.pending} points pending review</Text> : null}
            </View>
          ) : null}
          {leagueId ? <ProjectionLine leagueId={leagueId} /> : null}
          <RosterTotal total={roster.total} bonusPoints={roster.bonusPoints} bonusLabels={roster.bonusLabels} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.rowMin,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
    borderTopWidth: hairline,
    borderTopColor: colors.divider,
  },
  label: { ...type.body, flex: 1, color: colors.text },
  body: { gap: spacing.md, paddingTop: spacing.sm },
  inset: { paddingHorizontal: SCREEN_MARGIN },
  plan: { gap: spacing.sm },
  meta: { ...type.small, color: colors.textMuted },
});
