import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { PressScale } from "@/components/motion";

import { BORDER, colors, font, fontFamily, MIN_TARGET, radius, spacing } from "@/theme";

import { Icon, type IconName } from "./Icon";

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  /** For a label that means nothing out of context, such as "$5". Defaults to the label. */
  accessibilityLabel?: string;
  /** Layout only, for example `{ flex: 1 }` for two buttons side by side. */
  style?: StyleProp<ViewStyle>;
};

/** A secondary action: green outline and text on a rounded surface. */
export function OutlinedPillButton({ label, onPress, icon, disabled = false, accessibilityLabel = label, style }: Props) {
  const tint = disabled ? colors.textFaint : colors.accent;
  return (
    <PressScale
      style={[styles.pill, { borderColor: tint }, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {icon ? <Icon name={icon} size={16} color={tint} /> : null}
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: MIN_TARGET,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    borderWidth: BORDER,
    backgroundColor: colors.surface,
  },
  label: { fontSize: font.body, fontFamily: fontFamily.bold },
});
