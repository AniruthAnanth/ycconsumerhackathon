import { StyleSheet, Text, View } from "react-native";

import { Score } from "@/components/ui";
import { colors, font, hairline, spacing } from "@/theme";

/** The week's total at the bottom right of the roster, as ESPN shows a team total. */
export function RosterTotal({ total }: { total: number | null }) {
  return (
    <View style={styles.bar}>
      <Text style={styles.label}>TOTAL</Text>
      <Score value={total} size="total" />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  label: { fontSize: font.label, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.6 },
});
