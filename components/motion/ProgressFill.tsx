import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { progress, radius, spring } from "@/theme";

import { useReduceMotion } from "./useReduceMotion";

type Props = {
  /** 0 to 1. */
  ratio: number;
  /** Fill colour; defaults to the theme's progress green. */
  color?: string;
  /** Track colour; defaults to the theme's soft green. */
  track?: string;
  height?: number;
};

/**
 * A rounded progress bar whose fill springs to a new ratio, from empty on first mount. The bar
 * draws only; the caller exposes the value to screen readers once, in words.
 */
export function ProgressFill({ ratio, color = progress.fill, track = progress.track, height = progress.height }: Props) {
  const reduceMotion = useReduceMotion();
  const target = Math.min(Math.max(ratio, 0), 1);
  const shown = useSharedValue(reduceMotion ? target : 0);
  useEffect(() => {
    shown.value = reduceMotion ? target : withSpring(target, spring.gentle);
  }, [reduceMotion, shown, target]);
  const fill = useAnimatedStyle(() => ({ width: `${shown.value * 100}%` }));
  return (
    <View style={[styles.track, { height, backgroundColor: track }]} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill },
});
