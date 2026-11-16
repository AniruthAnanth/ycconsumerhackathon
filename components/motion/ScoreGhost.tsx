import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { formatGain } from "@/lib/taskDone";
import { colors, doneMoment, fontFamily, font, tabular } from "@/theme";

import { ease } from "./ease";

/** Beat 4: a copy of the points floats up off the pill and fades, as if it flew to the week score. */
export function ScoreGhost({ points, animate }: { points: number; animate: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!animate) return;
    progress.value = 0;
    progress.value = withDelay(doneMoment.ghostDelayMs, withTiming(1, { duration: doneMoment.ghostMs, easing: ease.standard }));
  }, [animate, progress]);
  const float = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.15, 1], [0, 1, 0]),
    transform: [{ translateY: -progress.value * doneMoment.ghostRise }],
  }));
  if (!animate) return null;
  return (
    <Animated.Text pointerEvents="none" style={[styles.ghost, float]} importantForAccessibility="no" accessibilityElementsHidden>
      {formatGain(points)}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  ghost: { position: "absolute", right: 0, top: 0, opacity: 0, fontFamily: fontFamily.extraBold, fontSize: font.meta, color: colors.accent, ...tabular },
});
