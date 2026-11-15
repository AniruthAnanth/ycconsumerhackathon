import { StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, hairline, SCREEN_MARGIN } from "@/theme";

/** The small uppercase strip above a group of rows: a label on the left, a column name on the right. */
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
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SCREEN_MARGIN,
    backgroundColor: colors.strip,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  label: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted, letterSpacing: 0.6 },
});
