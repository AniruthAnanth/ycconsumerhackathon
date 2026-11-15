import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { errorMessage } from "@/components/capture/errorMessage";
import { colors, font, hairline, spacing } from "@/theme";

type Phase = { kind: "idle" } | { kind: "running" } | { kind: "done" } | { kind: "failed"; message: string };

type Props = {
  label: string;
  run: () => Promise<unknown>;
  /** Shown on the right while idle, for example PLAYING on the current player. */
  tag?: string;
  disabled?: boolean;
};

/**
 * One demo action per row. The row itself reports the outcome, so the presenter can fire an
 * action and see that it landed without leaving the screen.
 */
export function ActionRow({ label, run, tag, disabled }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const onPress = async () => {
    setPhase({ kind: "running" });
    try {
      await run();
      setPhase({ kind: "done" });
    } catch (error) {
      setPhase({ kind: "failed", message: errorMessage(error) });
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || phase.kind === "running"}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {phase.kind === "failed" ? (
          <Text style={styles.error} numberOfLines={2}>
            {phase.message}
          </Text>
        ) : null}
      </View>
      {phase.kind === "running" ? <ActivityIndicator color={colors.textMuted} /> : null}
      {phase.kind === "done" ? <Text style={styles.done}>DONE</Text> : null}
      {phase.kind === "idle" && tag ? <Text style={styles.tag}>{tag}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.35 },
  text: { flex: 1 },
  label: { color: colors.text, fontSize: font.title, fontWeight: "700" },
  error: { color: colors.danger, fontSize: font.meta, marginTop: 2 },
  done: { color: colors.tabActive, fontSize: font.label, fontWeight: "700", letterSpacing: 0.6 },
  tag: { color: colors.accent, fontSize: font.label, fontWeight: "700", letterSpacing: 0.6 },
});
