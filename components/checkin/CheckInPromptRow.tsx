import { Pressable, StyleSheet, Text, View } from "react-native";

import { RowDivider } from "@/components/ui";
import { colors, font, fontFamily, layout, radius, SCREEN_MARGIN, spacing } from "@/theme";

export type CheckInPromptKind = "drop" | "nearby" | "at_risk";

type Props = {
  kind: CheckInPromptKind;
  /** Short ticker tag, e.g. "LIVE 47M". */
  label: string;
  /** One sentence naming the rival and the gap. */
  line: string;
  onCheckIn: () => void;
};

// A live drop is the only thing that should read as urgent, so it alone gets the
// danger red; the other two stay on the app's own colours.
const LIVE_RED = colors.danger;

const labelColor: Record<CheckInPromptKind, string> = {
  drop: LIVE_RED,
  nearby: colors.accent,
  at_risk: colors.text,
};

/**
 * One ticker-style line above the roster. It is at least 44 pt tall and never wraps:
 * the prompt must not push the roster down, whatever the server sends.
 */
export function CheckInPromptRow({ kind, label, line, onCheckIn }: Props) {
  return (
    <View style={styles.row} testID="checkin-prompt">
      <Text style={[styles.label, { color: labelColor[kind] }]} numberOfLines={1}>
        {label}
      </Text>
      {/* A long task title shrinks a little before it is cut off, so the rival and the gap stay whole. */}
      <Text style={styles.line} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit minimumFontScale={0.85}>
        {line}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={onCheckIn}
        // A 32 pt pill plus 8 pt above and below clears the 44 pt touch target.
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Check In"
        testID="checkin-prompt-button"
      >
        <Text style={styles.buttonText}>Check In</Text>
      </Pressable>
      <RowDivider inset={SCREEN_MARGIN} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.rowMin,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: SCREEN_MARGIN,
    backgroundColor: colors.background,
  },
  label: {
    flexShrink: 0,
    fontSize: font.label,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  line: {
    flex: 1,
    fontSize: font.meta,
    fontFamily: fontFamily.semiBold,
    color: colors.text,
  },
  button: {
    flexShrink: 0,
    minHeight: layout.avatarCompact,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  pressed: { opacity: 0.8 },
  buttonText: {
    fontSize: font.meta,
    fontFamily: fontFamily.bold,
    color: colors.onAccent,
  },
});
