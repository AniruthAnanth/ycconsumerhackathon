import { Pressable, StyleSheet, Text, View } from "react-native";

import { Divider, formatScore } from "@/components/ui";
import { colors, font, fontFamily, hairline, layout, SCREEN_MARGIN, spacing, tabular } from "@/theme";

import type { SeasonMatchup, SeasonPlayer, SeasonWeek } from "./types";

type Props = {
  weeks: SeasonWeek[];
  meId: string;
  onPlayerPress?: (userId: string) => void;
};

/** Every week of the season as an ESPN scoreboard: two lines per matchup, byes underneath. */
export function SeasonSchedule({ weeks, meId, onPlayerPress }: Props) {
  return (
    <View>
      {weeks.map((week) => (
        <View key={week.number}>
          <WeekHeader week={week} />
          {week.matchups.map((matchup) => (
            <View key={matchup.a.userId + matchup.b.userId}>
              <ScoreLine player={matchup.a} score={matchup.scoreA} matchup={matchup} meId={meId} onPress={onPlayerPress} />
              <ScoreLine player={matchup.b} score={matchup.scoreB} matchup={matchup} meId={meId} onPress={onPlayerPress} />
              <Divider inset={SCREEN_MARGIN} />
            </View>
          ))}
          {week.byes.length > 0 ? (
            <Text style={styles.note}>BYE  {week.byes.map((player) => player.name).join(", ")}</Text>
          ) : null}
          {week.matchups.length === 0 && week.byes.length === 0 ? <Text style={styles.note}>TBD</Text> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * Not the shared SectionLabel: the live week's status has to be accent blue,
 * and SectionLabel only takes plain strings for its right-hand side.
 */
function WeekHeader({ week }: { week: SeasonWeek }) {
  const title = week.round ? `Week ${week.number} · ${week.round}` : `Week ${week.number}`;
  return (
    <View style={styles.header}>
      <Text style={styles.headerLabel}>{title.toUpperCase()}</Text>
      {week.status === "live" ? <Text style={[styles.headerLabel, styles.live]}>LIVE</Text> : null}
      {week.status === "final" ? <Text style={styles.headerLabel}>FINAL</Text> : null}
    </View>
  );
}

type ScoreLineProps = {
  player: SeasonPlayer;
  score: number | null;
  matchup: SeasonMatchup;
  meId: string;
  onPress?: (userId: string) => void;
};

function ScoreLine({ player, score, matchup, meId, onPress }: ScoreLineProps) {
  const decided = matchup.winnerId !== null;
  const lost = decided && matchup.winnerId !== player.userId;
  const won = decided && !lost;
  const line = (
    <View style={styles.line}>
      <Text style={[styles.name, won && styles.won, lost && styles.lost, player.userId === meId && styles.me]} numberOfLines={1}>
        {player.name}
      </Text>
      <Text style={[styles.score, score === null && styles.unscored, lost && styles.lost]}>{formatScore(score)}</Text>
    </View>
  );
  if (!onPress) return line;
  return (
    <Pressable onPress={() => onPress(player.userId)} accessibilityRole="button" accessibilityLabel={player.name}>
      {line}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SCREEN_MARGIN,
    backgroundColor: colors.strip,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  headerLabel: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted, letterSpacing: 0.6 },
  live: { color: colors.accent },
  line: {
    minHeight: layout.rowMin,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: SCREEN_MARGIN,
    gap: layout.columnGap,
  },
  name: { flex: 1, fontFamily: fontFamily.regular, fontSize: font.title, color: colors.text },
  won: { fontFamily: fontFamily.bold },
  lost: { color: colors.textMuted },
  me: { color: colors.accent },
  score: { fontSize: font.score, fontFamily: fontFamily.extraBold, color: colors.text, ...tabular, minWidth: layout.numericColumn, textAlign: "right" },
  unscored: { color: colors.textFaint },
  note: {
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: font.meta,
    color: colors.textMuted,
  },
});
