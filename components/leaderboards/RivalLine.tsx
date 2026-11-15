import { StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, hairline, SCREEN_MARGIN, spacing } from "@/theme";

/** The one-line callout above the table: "Maya is 15 ahead of you". Renders nothing without a rival. */
export function RivalLine({ label }: { label: string | undefined }) {
  if (!label) return null;
  return (
    <View style={styles.line}>
      <Text style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    paddingVertical: spacing.sm,
    paddingHorizontal: SCREEN_MARGIN,
    backgroundColor: colors.background,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  text: { fontSize: font.meta, fontFamily: fontFamily.semiBold, color: colors.accent },
});
