import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReduceMotion } from "@/components/motion";
import { systemTabBar } from "@/lib/native/nativeTabs";
import { BORDER, colors, font, fontFamily, layout, radius, spacing, spring } from "@/theme";

import { Icon, type IconName } from "./Icon";

type Tab<Key extends string> = { key: Key; label: string; icon: IconName; testID: string };

type Props<Key extends string> = {
  tabs: readonly Tab<Key>[];
  active: Key;
  onChange: (key: Key) => void;
};

// Liquid glass is the iOS 26 material; every other platform gets a blurred paper bar instead.
const liquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable();

/** The gap under the bar: the home indicator's safe area, or a small margin on phones without one. */
function useBarBottom() {
  return Math.max(useSafeAreaInsets().bottom, spacing.md);
}

/**
 * How far a tab's scroll content must reach past the bottom so its last row clears the tab bar:
 * the system bar's height over the home indicator in the iOS build, the floating GlassTabBar elsewhere.
 * Tab screens pad their scroll content and scroll indicator by this.
 */
export function useTabBarInset() {
  const glassBottom = useBarBottom();
  const safeBottom = useSafeAreaInsets().bottom;
  // iOS already insets a native tab's first scroll view past the system bar (automatic content
  // insets), so adding the bar height again left about 60 pt of empty space: only the margin goes on top.
  return systemTabBar ? spacing.md : glassBottom + layout.tabBar + spacing.md;
}

/**
 * How far content pinned to a tab's bottom edge (outside any scroll view, so iOS doesn't inset it)
 * must sit to clear the tab bar: the full system bar over the home indicator in the iOS build.
 */
export function usePinnedTabBarInset() {
  const scrollInset = useTabBarInset();
  const safeBottom = useSafeAreaInsets().bottom;
  return systemTabBar ? safeBottom + layout.systemTabBar : scrollInset;
}

/**
 * The floating, rounded tab bar over the bottom of the tabs, drawn in liquid glass where iOS has it.
 * Content scrolls underneath; a green-tinted pill slides to the selected tab.
 */
export function GlassTabBar<Key extends string>({ tabs, active, onChange }: Props<Key>) {
  const bottom = useBarBottom();
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const tabWidth = (width - 2 * spacing.xs) / tabs.length;
  const index = Math.max(0, tabs.findIndex((tab) => tab.key === active));
  const pill = useAnimatedStyle(() => {
    const x = index * tabWidth;
    return { width: tabWidth, transform: [{ translateX: reduceMotion ? x : withSpring(x, spring.snappy) }] };
  });

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <View style={styles.bar} accessibilityRole="tablist" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {liquidGlass ? (
          <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" tintColor={colors.glassTint} />
        ) : (
          // The paper fill is its own layer over the blur: a background colour on BlurView itself is dropped on some
          // devices, and Android draws no blur at all without the experimental method, so the fill alone must hide the rows.
          <>
            <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={90} />
            <View style={[StyleSheet.absoluteFill, styles.fill]} pointerEvents="none" />
          </>
        )}
        {width > 0 ? <Animated.View style={[styles.pill, pill]} pointerEvents="none" /> : null}
        {tabs.map((tab) => {
          const selected = tab.key === active;
          const tint = selected ? colors.accent : colors.textMuted;
          return (
            <Pressable
              key={tab.key}
              testID={tab.testID}
              style={styles.tab}
              onPress={() => onChange(tab.key)}
              // "button" rather than "tab": iOS has no tab trait, so VoiceOver and the device scripts only see a button.
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
            >
              <Icon name={tab.icon} size={22} color={tint} />
              <Text style={[styles.label, { color: tint }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg },
  bar: {
    height: layout.tabBar,
    flexDirection: "row",
    borderRadius: radius.pill,
    borderWidth: BORDER,
    borderColor: colors.glassEdge,
    overflow: "hidden",
    padding: spacing.xs,
  },
  fill: { backgroundColor: colors.glassFill },
  pill: {
    position: "absolute",
    top: spacing.xs,
    bottom: spacing.xs,
    left: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.glassPill,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xs },
  label: { fontSize: font.label, fontFamily: fontFamily.bold },
});
