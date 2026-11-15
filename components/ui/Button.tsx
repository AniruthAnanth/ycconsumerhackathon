import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { colors, font, fontFamily, radius, spacing } from "@/theme";

type Props = {
  label: string;
  onPress: () => void;
  /** Shows a spinner and ignores taps while the action runs. */
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** The one filled button a screen may have: its single obvious next action. */
export function Button({ label, onPress, loading = false, disabled = false, style }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      style={({ pressed }) => [styles.button, inactive && styles.inactive, pressed && styles.pressed, style]}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    borderRadius: radius.control,
    backgroundColor: colors.accent,
  },
  inactive: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  label: { fontSize: font.score, fontFamily: fontFamily.bold, color: colors.onAccent },
});
