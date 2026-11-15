import { Pressable, StyleSheet, Text, View } from "react-native";

import { Divider, formatScore } from "@/components/ui";
import { colors, font, hairline, spacing } from "@/theme";

type SeasonPlayer = { userId: string; name: string; avatarUrl?: string };

type SeasonMatchup = {
  a: SeasonPlayer;
  b: SeasonPlayer;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
};

type SeasonWeek = {
  number: number;
  status: "final" | "live" | "upcoming";
  round?: string;
  matchups: SeasonMatchup[];
  byes: SeasonPlayer[];
};

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
              <Divider />
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
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    backgroundColor: colors.strip,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  headerLabel: { fontSize: font.label, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.6 },
  live: { color: colors.accent },
  line: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  name: { flex: 1, fontSize: font.title, color: colors.text },
  won: { fontWeight: "700" },
  lost: { color: colors.textMuted },
  me: { color: colors.accent },
  score: { fontSize: font.score, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  unscored: { color: colors.textFaint },
  note: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.meta,
    color: colors.textMuted,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
});
