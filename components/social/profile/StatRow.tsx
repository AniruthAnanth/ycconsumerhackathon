import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, font, hairline, spacing } from "@/theme";

/** One dense profile row: label on the left, bold value (text or custom content) on the right. */
export function StatRow({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {children ?? <Text style={styles.value}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  label: { fontSize: font.title, color: colors.text },
  value: { fontSize: font.score, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
});
