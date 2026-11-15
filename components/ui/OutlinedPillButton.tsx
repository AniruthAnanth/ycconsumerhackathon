import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { colors, font, spacing } from "@/theme";

import { Icon, type IconName } from "./Icon";

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  /** Layout only, for example `{ flex: 1 }` for two buttons side by side. */
  style?: StyleProp<ViewStyle>;
};

/** A secondary action: blue outline, blue text, fully rounded, as ESPN's Quick Lineup button. */
export function OutlinedPillButton({ label, onPress, icon, disabled = false, style }: Props) {
  const tint = disabled ? colors.textFaint : colors.accent;
  return (
    <Pressable
      style={({ pressed }) => [styles.pill, { borderColor: tint }, pressed && styles.pressed, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon ? <Icon name={icon} size={16} color={tint} /> : null}
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: colors.background,
  },
  pressed: { backgroundColor: colors.accentTint },
  label: { fontSize: font.body, fontWeight: "700" },
});
