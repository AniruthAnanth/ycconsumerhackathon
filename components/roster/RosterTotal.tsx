import { StyleSheet, Text, View } from "react-native";

import { Score } from "@/components/ui";
import { colors, font, fontFamily, hairline, spacing } from "@/theme";

type Props = {
  total: number | null;
  /** Points the week earned beyond its rows; the row is hidden at zero. */
  bonusPoints?: number;
  bonusLabels?: readonly string[];
};

/**
 * The week's total at the bottom right of the roster, as ESPN shows a team
 * total. The total is the League and Matchup number, which includes bonuses no
 * row carries, so a Bonuses line above it keeps the column adding up.
 */
export function RosterTotal({ total, bonusPoints = 0, bonusLabels = [] }: Props) {
  return (
    <View style={styles.foot}>
      {bonusPoints > 0 ? (
        <View style={styles.bonuses}>
          <Text style={styles.label}>BONUSES</Text>
          <Text style={styles.names} numberOfLines={1}>
            {bonusLabels.join(", ")}
          </Text>
          <Score value={bonusPoints} />
        </View>
      ) : null}
      <View style={styles.bar}>
        <Text style={styles.label}>TOTAL</Text>
        <Score value={total} size="total" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  foot: { borderTopWidth: hairline, borderTopColor: colors.divider, backgroundColor: colors.background },
  bonuses: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  names: { flex: 1, fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  bar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  label: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted, letterSpacing: 0.6 },
});
