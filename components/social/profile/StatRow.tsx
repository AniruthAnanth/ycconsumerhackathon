import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { RowDivider } from "@/components/ui";
import { colors, font, fontFamily, layout, SCREEN_MARGIN, spacing, tabular } from "@/theme";

/** One dense profile row: label on the left, bold value (text or custom content) on the right. */
export function StatRow({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {children ?? <Text style={styles.value}>{value}</Text>}
      <RowDivider inset={SCREEN_MARGIN} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.rowMin,
    paddingVertical: spacing.md,
    paddingHorizontal: SCREEN_MARGIN,
    gap: layout.columnGap,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: { flex: 1, fontFamily: fontFamily.regular, fontSize: font.title, color: colors.text },
  value: { fontSize: font.score, fontFamily: fontFamily.bold, color: colors.text, ...tabular, textAlign: "right" },
});
