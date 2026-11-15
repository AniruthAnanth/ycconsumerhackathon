import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { errorMessage } from "@/lib/errorMessage";
import { RowDivider } from "@/components/ui";
import { colors, font, fontFamily, layout, SCREEN_MARGIN, spacing } from "@/theme";

type Phase = { kind: "idle" } | { kind: "running" } | { kind: "done" } | { kind: "failed"; message: string };

type Props = {
  label: string;
  run: () => Promise<unknown>;
  /** Shown on the right while idle, for example PLAYING on the current player. */
  tag?: string;
  disabled?: boolean;
};

/** How long DONE stays up before the row shows its tag again. */
const DONE_MS = 1500;

/**
 * One demo action per row. The row itself reports the outcome, so the presenter can fire an
 * action and see that it landed without leaving the screen.
 */
export function ActionRow({ label, run, tag, disabled }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (settling.current) clearTimeout(settling.current);
    },
    [],
  );

  const onPress = async () => {
    if (settling.current) clearTimeout(settling.current);
    setPhase({ kind: "running" });
    try {
      await run();
      setPhase({ kind: "done" });
      // DONE confirms the tap and then steps aside: left up, it would hide PLAYING on the player
      // just switched to, and a second tap on the same action would look like it did nothing.
      settling.current = setTimeout(() => setPhase({ kind: "idle" }), DONE_MS);
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
      <RowDivider inset={SCREEN_MARGIN} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.rowMin,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.35 },
  text: { flex: 1 },
  label: { color: colors.text, fontSize: font.title, fontFamily: fontFamily.bold },
  error: { color: colors.danger, fontFamily: fontFamily.regular, fontSize: font.meta, marginTop: spacing.xs },
  done: { color: colors.tabActive, fontSize: font.label, fontFamily: fontFamily.bold, letterSpacing: 0.6 },
  tag: { color: colors.accent, fontSize: font.label, fontFamily: fontFamily.bold, letterSpacing: 0.6 },
});
