import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { MatchupOdds } from "@/components/markets/MatchupOdds";
import { CountUp, PressScale } from "@/components/motion";
import { Avatar } from "@/components/ui";
import { formatScore } from "@/lib/taskText";
import { colors, fontFamily, layout, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import type { Matchup, MatchupSide } from "../contract";
import { possiblePoints } from "./matchupLogic";

/** Me against the opponent: the two scores are the biggest type on the screen, everything else sits under them. */
export function MatchupHero({ matchup }: { matchup: Matchup }) {
  const { me, opponent, rows } = matchup;
  const minePossible = possiblePoints(rows, "mine", me.total);
  const theirsPossible = possiblePoints(rows, "theirs", opponent.total);
  // Before anyone drafts there is nothing to win yet: no "of 0 possible" and no 50/50 bar.
  const undrafted = minePossible === 0 && theirsPossible === 0;
  return (
    <View style={styles.hero}>
      <View style={styles.sides}>
        <HeroSide side={me} caption={undrafted ? "Draft to start" : `of ${formatScore(minePossible)} possible`} align="flex-start" />
        <HeroSide side={opponent} caption={undrafted ? "Draft to start" : `of ${formatScore(theirsPossible)} possible`} align="flex-end" />
      </View>
      {undrafted ? null : <MatchupOdds me={{ name: me.name, chance: me.winProbability }} them={{ name: opponent.name, chance: opponent.winProbability }} />}
    </View>
  );
}

function HeroSide({ side, caption, align }: { side: MatchupSide; caption: string; align: "flex-start" | "flex-end" }) {
  const router = useRouter();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${side.name}'s profile`}
      onPress={() => router.push(`/profile/${side.userId}`)}
      style={[styles.side, { alignItems: align }]}
    >
      <Avatar name={side.name} size={layout.rowMin} />
      <Text style={styles.name} numberOfLines={2}>
        {side.name}
      </Text>
      <CountUp style={styles.score} value={side.total} format={formatScore} decimals={1} numberOfLines={1} adjustsFontSizeToFit />
      <Text style={styles.possible}>{caption}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: SCREEN_MARGIN, paddingTop: spacing.lg, gap: spacing.lg },
  sides: { flexDirection: "row", gap: spacing.lg },
  side: { flex: 1, gap: spacing.xs },
  name: { ...type.label, color: colors.textMuted, maxWidth: "100%" },
  score: { ...type.display, color: colors.text, ...tabular, maxWidth: "100%" },
  possible: { color: colors.textFaint, fontFamily: fontFamily.semiBold, fontSize: type.caption.fontSize },
});
