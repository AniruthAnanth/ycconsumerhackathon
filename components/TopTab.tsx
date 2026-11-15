import type { TabTriggerSlotProps } from "expo-router/ui";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, spacing, tabUnderlineHeight } from "@/theme";

/** One label in the top tab bar. The active tab gets the green underline. */
export function TopTab({
  children,
  isFocused,
  ...pressableProps
}: Omit<TabTriggerSlotProps, "ref">) {
  return (
    <Pressable
      {...pressableProps}
      style={[styles.tab, isFocused && styles.tabActive]}
    >
      <Text style={[styles.label, isFocused && styles.labelActive]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: tabUnderlineHeight,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.tabActive,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  labelActive: {
    color: colors.text,
  },
});
