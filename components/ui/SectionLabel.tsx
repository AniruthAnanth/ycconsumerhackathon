import { StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, SCREEN_MARGIN, spacing } from "@/theme";

/**
 * The small uppercase header above a group of rows: a label on the left, a column name on the right.
 * It sits on the canvas with the 20-pt leading edge, iOS style, so the white section below reads as its own block.
 */
export function SectionLabel({ left, right }: { left: string; right?: string }) {
  return (
    <View style={styles.strip}>
      <Text style={styles.label}>{left.toUpperCase()}</Text>
      {right ? <Text style={styles.label}>{right.toUpperCase()}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: SCREEN_MARGIN,
    paddingBottom: spacing.sm,
    backgroundColor: colors.strip,
  },
  label: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted, letterSpacing: 0.6 },
});
