import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, hairline, layout, MIN_TARGET, SCREEN_MARGIN, spacing } from "@/theme";

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
          <Pressable onPress={onBack} style={styles.action} accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="chevron-back" size={24} />
          </Pressable>
        ) : null}
      </View>
      {onTitlePress ? (
        <Pressable style={styles.center} onPress={onTitlePress} accessibilityRole="button" accessibilityLabel={`${title}, switch league`}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Icon name="caret-down" size={12} />
        </Pressable>
      ) : (
        // A plain heading rather than a disabled button, which a screen reader would announce as dimmed.
        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        </View>
      )}
      <View style={[styles.side, styles.right]}>
        {right ??
          (onChatPress ? (
            <Pressable onPress={onChatPress} style={[styles.action, styles.actionEnd]} accessibilityRole="button" accessibilityLabel="League chat">
              <Icon name="chatbubble-ellipses-outline" size={22} />
            </Pressable>
          ) : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: layout.bar,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SCREEN_MARGIN,
    backgroundColor: colors.background,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  // Equal-width sides keep the title centred whichever actions are present.
  side: { width: layout.barSide, flexDirection: "row", alignItems: "center" },
  right: { justifyContent: "flex-end" },
  // A real 44-pt target whose glyph still sits on the margin edge.
  action: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, justifyContent: "center" },
  actionEnd: { alignItems: "flex-end" },
  center: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  title: { flexShrink: 1, fontSize: font.header, fontFamily: fontFamily.extraBold, color: colors.text },
});
