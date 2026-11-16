import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useState, type ReactNode } from "react";
import { Platform, StyleSheet, type StyleProp, type TextStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { useReduceMotion } from "@/components/motion";
import { colors, duration, hairline, layout, SCREEN_MARGIN, spacing, type } from "@/theme";

/**
 * The large title's fixed height. It is also the scroll distance at which the compact bar takes
 * over, so it is a constant rather than a measurement: the collapse never waits on a layout pass.
 */
export const LARGE_TITLE_HEIGHT = spacing.xs + type.title.lineHeight + spacing.sm;
/** The compact title and the glass fade in over the last quarter of the large title's travel. */
const FADE_START = LARGE_TITLE_HEIGHT * 0.75;
/** Pulling down past the top stretches the large title, as in Settings; it stops growing here. */
const STRETCH_DISTANCE = LARGE_TITLE_HEIGHT * 2;
const MAX_STRETCH = 1.1;
/** expo-blur's 1 to 100 scale: enough to frost text passing under the bar without greying it. */
const BLUR_INTENSITY = 80;

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
// The same split as the tab bar: liquid glass on iOS 26, a blurred paper bar everywhere else.
const liquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable();

/**
 * Drives a screen's large title and compact glass header from its scroll position. Put onScroll
 * on an Animated.ScrollView or Animated.FlatList with scrollEventThrottle={16}, pad its content
 * by contentInsetTop so it starts below the bar, and pass scrollY to both <Header> and
 * <LargeTitle>. The screen's <Screen> drops the top edge, since the bar covers the status bar.
 */
export function useCollapsingHeader() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const insets = useSafeAreaInsets();
  return { scrollY, onScroll, contentInsetTop: insets.top + layout.bar };
}

/** The screen's title at rest: the first child of the scroll content, left on the margin. */
export function LargeTitle({ title, scrollY }: { title: string; scrollY: SharedValue<number> }) {
  const reduceMotion = useReduceMotion();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [LARGE_TITLE_HEIGHT / 2, LARGE_TITLE_HEIGHT], [1, 0], Extrapolation.CLAMP),
    // Reduce Motion keeps only the crossfade: no stretch on the pull-down.
    transform: [{ scale: reduceMotion ? 1 : interpolate(scrollY.value, [-STRETCH_DISTANCE, 0], [MAX_STRETCH, 1], Extrapolation.CLAMP) }],
  }));
  return (
    <Animated.Text style={[styles.largeTitle, style]} numberOfLines={1} accessibilityRole="header">
      {title}
    </Animated.Text>
  );
}

/** The bar's centred title, hidden while the large title shows and faded in as it leaves. */
export function CompactTitle({
  scrollY,
  style,
  children,
  accessibilityRole,
}: {
  scrollY: SharedValue<number>;
  style: StyleProp<TextStyle>;
  children: string;
  accessibilityRole?: "header";
}) {
  const reduceMotion = useReduceMotion();
  const fade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [FADE_START, LARGE_TITLE_HEIGHT], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: reduceMotion ? 0 : interpolate(scrollY.value, [FADE_START, LARGE_TITLE_HEIGHT], [spacing.xs, 0], Extrapolation.CLAMP) }],
  }));
  return (
    <Animated.Text style={[style, fade]} numberOfLines={1} accessibilityRole={accessibilityRole}>
      {children}
    </Animated.Text>
  );
}

/**
 * The compact bar floating over the scroll content: it covers the status bar too, starts clear,
 * and gains liquid glass (iOS 26) or a light blur plus a hairline as the large title scrolls away.
 */
export function CollapsingBar({ scrollY, children }: { scrollY: SharedValue<number>; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const hairlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [FADE_START, LARGE_TITLE_HEIGHT], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[styles.overlay, { paddingTop: insets.top }]}>
      {liquidGlass ? <GlassBackground scrollY={scrollY} /> : <BlurBackground scrollY={scrollY} />}
      <Animated.View style={[styles.hairline, hairlineStyle]} pointerEvents="none" />
      {children}
    </Animated.View>
  );
}

// A visual effect view must not be faded through opacity (iOS renders it wrong), so the glass
// switches material natively once the threshold is crossed, as the system bars do.
function GlassBackground({ scrollY }: { scrollY: SharedValue<number> }) {
  const [solid, setSolid] = useState(false);
  useAnimatedReaction(
    () => scrollY.value > FADE_START,
    (now, previous) => {
      if (now !== previous) scheduleOnRN(setSolid, now);
    },
  );
  return (
    <GlassView
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      colorScheme="light"
      tintColor={colors.glassTint}
      glassEffectStyle={{ style: solid ? "regular" : "none", animate: true, animationDuration: duration.base / 1000 }}
    />
  );
}

// On iOS the blur's intensity follows the scroll, for the same reason. Elsewhere the whole layer
// fades instead, because web's blur keeps a saturate filter that tints the bar even at zero.
const fadesByIntensity = Platform.OS === "ios";

function BlurBackground({ scrollY }: { scrollY: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => ({
    intensity: interpolate(scrollY.value, [FADE_START, LARGE_TITLE_HEIGHT], [0, BLUR_INTENSITY], Extrapolation.CLAMP),
  }));
  const fade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [FADE_START, LARGE_TITLE_HEIGHT], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, !fadesByIntensity && fade]} pointerEvents="none">
      <AnimatedBlurView
        style={StyleSheet.absoluteFill}
        tint="light"
        intensity={fadesByIntensity ? 0 : BLUR_INTENSITY}
        animatedProps={fadesByIntensity ? animatedProps : undefined}
      />
      <Animated.View style={[StyleSheet.absoluteFill, styles.fill, fadesByIntensity && fade]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { backgroundColor: colors.glassFill },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 },
  hairline: { position: "absolute", left: 0, right: 0, bottom: 0, height: hairline, backgroundColor: colors.divider },
  largeTitle: {
    ...type.title,
    height: LARGE_TITLE_HEIGHT,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    paddingHorizontal: SCREEN_MARGIN,
    color: colors.text,
    transformOrigin: "left center",
  },
});
