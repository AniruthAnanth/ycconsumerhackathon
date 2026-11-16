import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { PressScale } from "@/components/motion";
import type { PressHaptic } from "@/lib/native/haptics";

import { colors, font, fontFamily, layout, radius, spacing } from "@/theme";

type Props = {
  label: string;
  onPress: () => void;
  /** Shows a spinner and ignores taps while the action runs. */
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Medium for a commitment (Lock Lineup, Submit Proof); "none" when onPress fires its own haptic. */
  haptic?: PressHaptic;
};

/** The one filled button a screen may have: its single obvious next action. */
export function Button({ label, onPress, loading = false, disabled = false, style, haptic }: Props) {
  const inactive = disabled || loading;
  return (
    <PressScale
      style={[styles.button, inactive && styles.inactive, style]}
      onPress={onPress}
      haptic={haptic}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.label}>{label}</Text>}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  button: {
    height: layout.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    borderRadius: radius.control,
    backgroundColor: colors.accent,
  },
  inactive: { opacity: 0.4 },
  label: { fontSize: font.score, fontFamily: fontFamily.bold, color: colors.onAccent },
});
