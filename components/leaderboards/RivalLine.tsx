import { StyleSheet, Text, View } from "react-native";

import { colors, font, hairline, spacing } from "@/theme";

/** The one-line callout above the table: "Maya is 15 ahead of you". Renders nothing without a rival. */
export function RivalLine({ label }: { label: string | undefined }) {
  if (!label) return null;
  return (
    <View style={styles.line}>
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    height: 32,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  text: { fontSize: font.meta, fontWeight: "600", color: colors.accent },
});
