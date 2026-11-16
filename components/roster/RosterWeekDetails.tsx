import { useQuery } from "convex/react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ProjectionLine } from "@/components/leaderboards";
import { MatchupOdds } from "@/components/markets/MatchupOdds";
import { PressRow } from "@/components/motion";
import { RosterBonuses } from "@/components/roster/RosterBonuses";
import { socialApi } from "@/components/social/contract";
import { Icon } from "@/components/ui";
import type { Roster } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, hairline, layout, SCREEN_MARGIN, spacing, type } from "@/theme";

/**
 * Everything about the week that does not decide what to do next: the win chance, the projection
 * and the bonuses. Roster keeps them one tap away behind a single chevron row, closed by default,
 * so the lineup is the first thing the player reads. The total itself lives only in the hero.
 */
export function RosterWeekDetails({ roster }: { roster: Roster }) {
  const [open, setOpen] = useState(false);
  const { leagueId, weekStart } = useCurrentLeague();
  const matchup = useQuery(socialApi.standings.matchup, open && leagueId && weekStart === undefined ? { leagueId } : "skip");

  return (
    <View>
      <PressRow
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
      </PressRow>
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
          {leagueId ? <ProjectionLine leagueId={leagueId} /> : null}
          <RosterBonuses bonusPoints={roster.bonusPoints} bonusLabels={roster.bonusLabels} />
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
});
