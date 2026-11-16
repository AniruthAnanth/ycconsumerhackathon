import { StyleSheet, Text, View } from "react-native";

import { RowDivider } from "@/components/ui";
import { colors, font, fontFamily, ROW_HEIGHT, SCREEN_MARGIN, spacing, tabular } from "@/theme";

import type { Matchup } from "../contract";
import { formatScore } from "@/lib/taskText";
import { bonusPoints } from "./matchupLogic";

const signed = (points: number) => `${points > 0 ? "+" : ""}${formatScore(points)}`;

/** The last Matchup line: bonuses that count toward each total but sit on no row, so the screen adds up. */
export function BonusRow({ matchup }: { matchup: Matchup }) {
  const mine = bonusPoints(matchup.rows, "mine", matchup.me.total);
  const theirs = bonusPoints(matchup.rows, "theirs", matchup.opponent.total);
  if (mine === 0 && theirs === 0) return null;
  return (
    <View accessible accessibilityLabel={`Bonuses: ${matchup.me.name} ${signed(mine)}, ${matchup.opponent.name} ${signed(theirs)}`}>
      <View style={styles.row}>
        <Text style={[styles.points, styles.left]}>{signed(mine)}</Text>
        <View style={styles.middle}>
          <Text style={styles.title}>Bonuses</Text>
          <Text style={styles.caption}>Slots, streak, challenges</Text>
        </View>
        <Text style={[styles.points, styles.right]}>{signed(theirs)}</Text>
      </View>
      <RowDivider inset={SCREEN_MARGIN} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: ROW_HEIGHT, paddingVertical: spacing.sm, paddingHorizontal: SCREEN_MARGIN, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  middle: { alignItems: "center", gap: spacing.xs },
  points: { flex: 1, color: colors.text, fontFamily: fontFamily.bold, fontSize: font.score, ...tabular },
  left: { textAlign: "left" },
  right: { textAlign: "right" },
  title: { color: colors.text, fontFamily: fontFamily.bold, fontSize: font.body },
  caption: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: font.meta },
});
