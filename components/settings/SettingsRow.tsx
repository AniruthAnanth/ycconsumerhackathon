import type { ReactNode } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { Icon } from "@/components/ui";
import { colors, font, fontFamily, layout, MIN_TARGET, spacing } from "@/theme";

type Props = {
  title: string;
  /** A second muted line under the title. */
  subtitle?: string;
  /** Muted text on the right, before the chevron: the current value. */
  value?: string;
  /** Drawn on the right instead of a value, such as the avatar. */
  accessory?: ReactNode;
  /** Makes the row a button with a chevron. */
  onPress?: () => void;
  /** Makes the row a switch; the row itself is then not a button. */
  switchValue?: boolean;
  onSwitch?: (value: boolean) => void;
  disabled?: boolean;
  /** Red title and no chevron: Leave, Sign out, Delete account. */
  destructive?: boolean;
  testID?: string;
  accessibilityLabel?: string;
};

/** One row of a SettingsGroup: a title, an optional subtitle and value, and a chevron or a Switch. */
export function SettingsRow({
  title,
  subtitle,
  value,
  accessory,
  onPress,
  switchValue,
  onSwitch,
  disabled = false,
  destructive = false,
  testID,
  accessibilityLabel,
}: Props) {
  const isSwitch = onSwitch !== undefined;
  const content = (
    <>
      <View style={styles.text}>
        <Text style={[styles.title, destructive && styles.destructive, disabled && styles.disabled]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {accessory}
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {isSwitch ? (
        <Switch
          value={switchValue ?? false}
          onValueChange={onSwitch}
          disabled={disabled}
          trackColor={{ true: colors.accent }}
          accessibilityLabel={accessibilityLabel ?? title}
          testID={testID}
        />
      ) : onPress && !destructive ? (
        <Icon name="chevron-forward" size={18} color={colors.textFaint} />
      ) : null}
    </>
  );

  if (isSwitch || !onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (value ? `${title}, ${value}` : title)}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TARGET + spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.accentTint },
  text: { flex: 1, gap: spacing.xs },
  title: { fontSize: font.title, fontFamily: fontFamily.semiBold, color: colors.text },
  destructive: { color: colors.danger },
  disabled: { color: colors.textFaint },
  subtitle: { fontSize: font.meta, fontFamily: fontFamily.regular, color: colors.textMuted },
  value: { flexShrink: 1, maxWidth: "50%", fontSize: font.body, fontFamily: fontFamily.regular, color: colors.textMuted },
});
