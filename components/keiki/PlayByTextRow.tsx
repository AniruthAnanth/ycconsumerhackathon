import { useMutation, useQuery } from "convex/react";
import { Linking, StyleSheet, Switch, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { colors, font, hairline, spacing } from "@/theme";

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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: font.title, fontWeight: "700", color: colors.text },
  copy: { fontSize: font.meta, color: colors.textMuted },
});
