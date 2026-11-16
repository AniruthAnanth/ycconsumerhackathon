import { StyleSheet, Switch, Text, View } from "react-native";

import { RowDivider } from "@/components/ui";
import { colors, font, fontFamily, layout, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing } from "@/theme";

import { usePlayByText } from "./usePlayByText";

/**
 * Opt in to playing over iMessage (usePlayByText holds the switch's behaviour).
 *
 * The row always renders. While the line loads, or where no number is configured, the switch
 * waits instead of the row vanishing, so its section is never a header with nothing under it.
 */
export function PlayByTextRow() {
  const playByText = usePlayByText();

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>Play by text</Text>
        <Text style={styles.copy}>{playByText.copy}</Text>
      </View>
      <Switch
        value={playByText.value}
        disabled={!playByText.ready}
        onValueChange={playByText.onValueChange}
        trackColor={{ true: colors.accent }}
        accessibilityLabel="Play by text"
      />
      <RowDivider inset={SCREEN_MARGIN} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT_COMPACT,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, gap: spacing.xs },
  title: { fontSize: font.title, fontFamily: fontFamily.bold, color: colors.text },
  copy: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
});
