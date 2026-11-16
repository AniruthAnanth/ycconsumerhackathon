import { StyleSheet, Text, View } from "react-native";

import { formatScore } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import type { Standing } from "@/lib/backend";
import { colors, font, fontFamily, layout, SCREEN_MARGIN, tabular, type } from "@/theme";

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** The one line that answers "where do I stand?" above the pot: rank of field, and points. */
export function MyRank({ rows, viewerId }: { rows: Standing[]; viewerId: Id<"users"> }) {
  const index = rows.findIndex((row) => row.userId === viewerId);
  if (index < 0) return null;
  const mine = rows[index];
  const rank = `${ordinal(index + 1)} of ${rows.length}`;
  return (
    <View style={styles.row} accessible accessibilityLabel={`You're ${rank}, ${mine.points} points`} testID="league-my-rank">
      <Text style={styles.rank}>{`You're ${rank}`}</Text>
      <Text style={styles.points}>{`${formatScore(mine.points)} pts`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: layout.rowMin, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_MARGIN },
  rank: { ...type.heading, color: colors.text },
  points: { fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted, ...tabular },
});
