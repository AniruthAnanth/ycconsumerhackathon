import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, hairline, spacing } from "@/theme";

import { Icon } from "./Icon";

type Props = {
  title: string;
  /** Shows the back chevron. */
  onBack?: () => void;
  /** Makes the title a button with a caret; the tabs use it to switch league. */
  onTitlePress?: () => void;
  /** Shows the chat icon that opens the league agent. */
  onChatPress?: () => void;
  /** Replaces the chat icon. */
  right?: ReactNode;
};

/** The bar at the top of every screen: back chevron, centred title, one action on the right. */
export function Header({ title, onBack, onTitlePress, onChatPress, right }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="chevron-back" size={24} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        style={styles.center}
        onPress={onTitlePress}
        disabled={!onTitlePress}
        accessibilityRole={onTitlePress ? "button" : "header"}
        accessibilityLabel={onTitlePress ? `${title}, switch league` : title}
      >
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {onTitlePress ? <Icon name="caret-down" size={12} /> : null}
      </Pressable>
      <View style={[styles.side, styles.right]}>
        {right ??
          (onChatPress ? (
            <Pressable onPress={onChatPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="League chat">
              <Icon name="chatbubble-ellipses-outline" size={22} />
            </Pressable>
          ) : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  // Equal-width sides keep the title centred whichever actions are present.
  side: { width: 56, flexDirection: "row", alignItems: "center" },
  right: { justifyContent: "flex-end" },
  center: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  title: { flexShrink: 1, fontSize: font.header, fontWeight: "700", color: colors.text },
});
