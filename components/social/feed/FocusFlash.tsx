import { useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";

import { ease, useReduceMotion } from "@/components/motion";
import { colors, duration } from "@/theme";

/** How long the tint holds before it fades, long enough to find the post after the scroll lands. */
const HOLD_MS = 1200;

/** Peak strength of the tint. It draws over the post (the swipe row is opaque), so it stays light enough to read through. */
const PEAK = 0.6;

/** Wraps a post and, while `active`, tints it briefly so the post a live toast opened is easy to spot. */
export function FocusFlash({ active, children }: { active: boolean; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    opacity.value = withSequence(
      withTiming(PEAK, { duration: reduceMotion ? 0 : duration.base }),
      withDelay(HOLD_MS, withTiming(0, { duration: reduceMotion ? 0 : duration.slow * 2, easing: ease.standard })),
    );
  }, [active, opacity, reduceMotion]);

  const tint = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View>
      {children}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, tint]} />
    </View>
  );
}

const styles = StyleSheet.create({ tint: { backgroundColor: colors.accentTint } });
