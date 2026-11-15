import { useMutation, useQuery } from "convex/react";
import { Linking, StyleSheet, Switch, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { RowDivider } from "@/components/ui";
import { colors, font, fontFamily, layout, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing } from "@/theme";

import { formatLineNumber } from "./formatLineNumber";

/**
 * Opt in to playing over iMessage. Turning it on also opens Messages with the join text typed:
 * on the shared number, sending that text is what lets the agent text the player back.
 *
 * The row always renders. While the line loads, or where no number is configured, the switch
 * waits instead of the row vanishing, so its section is never a header with nothing under it.
 */
export function PlayByTextRow() {
  const line = useQuery(api.keiki.line);
  const setOptIn = useMutation(api.keiki.setOptIn);

  async function onValueChange(optIn: boolean) {
    try {
      await setOptIn({ optIn });
    } catch {
      return;
    }
    if (!optIn || !line) return;
    try {
      await Linking.openURL(line.smsUrl);
    } catch {}
  }

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>Play by text</Text>
        <Text style={styles.copy}>
          {line
            ? `Get drops and send proofs by text at ${formatLineNumber(line.number)}.`
            : "Get drops and send proofs by text."}
        </Text>
      </View>
      <Switch
        value={line?.optedIn ?? false}
        disabled={!line}
        onValueChange={onValueChange}
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
