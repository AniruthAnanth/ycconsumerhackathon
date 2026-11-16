import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import { colors, font, fontFamily, hairline, layout, MIN_TARGET, SCREEN_MARGIN, spacing } from "@/theme";

import { CollapsingBar, CompactTitle } from "./CollapsingHeader";
import { Icon } from "./Icon";

type Props = {
  title: string;
  /** Shows the back chevron. */
  onBack?: () => void;
  /** Makes the title a button with a caret; the tabs use it to switch league. */
  onTitlePress?: () => void;
  /** Shows the settings gear on the left, opposite the chat icon; the tabs use it. */
  onSettingsPress?: () => void;
  /** Shows the chat icon that opens the league agent. */
  onChatPress?: () => void;
  /** Shows the close cross on the right, for a sheet or modal; a pushed screen uses onBack instead. */
  onClose?: () => void;
  /** Replaces the chat icon. */
  right?: ReactNode;
  /** Sits beside a switchable title in the same row; the tabs put the week pill here, so the header is one row. */
  accessory?: ReactNode;
  /**
   * From useCollapsingHeader(): floats the bar over the scroll content, clear at rest, and fades
   * the title and a glass background in once the screen's <LargeTitle> scrolls away.
   */
  scrollY?: SharedValue<number>;
};

/**
 * The bar at the top of every screen and sheet: 44 pt tall, centred title, back
 * chevron on the left for a pushed screen (the tabs put the settings gear there), close cross
 * on the right for a sheet.
 */
export function Header({ title, onBack, onTitlePress, onSettingsPress, onChatPress, onClose, right, accessory, scrollY }: Props) {
  const bar = (
    <View style={[styles.bar, scrollY && styles.barOverContent]}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.action} accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="chevron-back" size={24} />
          </Pressable>
        ) : onSettingsPress ? (
          <Pressable onPress={onSettingsPress} style={styles.action} accessibilityRole="button" accessibilityLabel="Settings" testID="header-settings">
            <Icon name="settings-outline" size={22} />
          </Pressable>
        ) : null}
      </View>
      {onTitlePress ? (
        <View style={styles.center}>
        <Pressable style={styles.titleButton} onPress={onTitlePress} accessibilityRole="button" accessibilityLabel={`${title}, switch league`}>
          {scrollY ? (
            <CompactTitle scrollY={scrollY} style={styles.title}>
              {title}
            </CompactTitle>
          ) : (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          )}
          <Icon name="caret-down" size={12} />
        </Pressable>
        {accessory}
        </View>
      ) : (
        // A plain heading rather than a disabled button, which a screen reader would announce as dimmed.
        <View style={styles.center}>
          {scrollY ? (
            <CompactTitle scrollY={scrollY} style={styles.title} accessibilityRole="header">
              {title}
            </CompactTitle>
          ) : (
            <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
          )}
        </View>
      )}
      <View style={[styles.side, styles.right]}>
        {right ??
          (onClose ? (
            <Pressable onPress={onClose} style={[styles.action, styles.actionEnd]} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={24} />
            </Pressable>
          ) : onChatPress ? (
            <Pressable onPress={onChatPress} style={[styles.action, styles.actionEnd]} accessibilityRole="button" accessibilityLabel="League chat">
              <Icon name="chatbubble-ellipses-outline" size={22} />
            </Pressable>
          ) : null)}
      </View>
    </View>
  );
  return scrollY ? <CollapsingBar scrollY={scrollY}>{bar}</CollapsingBar> : bar;
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
  // Collapsing mode: CollapsingBar draws the background and hairline, so the row itself is clear.
  barOverContent: { backgroundColor: "transparent", borderBottomWidth: 0 },
  // Equal-width sides keep the title centred whichever actions are present.
  side: { width: layout.barSide, flexDirection: "row", alignItems: "center" },
  right: { justifyContent: "flex-end" },
  // A real 44-pt target whose glyph still sits on the margin edge.
  action: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, justifyContent: "center" },
  actionEnd: { alignItems: "flex-end" },
  center: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  titleButton: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: layout.rowMin },
  title: { flexShrink: 1, fontSize: font.header, fontFamily: fontFamily.extraBold, color: colors.text },
});
