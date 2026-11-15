import { type ReactNode, useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { ease, ReorderRow, useReduceMotion } from "@/components/motion";
import { colors, duration } from "@/theme";

/**
 * A standings row that slides to its new rank (ReorderRow, on spring.gentle) when a leaguemate's
 * proof reorders the table, and flashes the accent tint as it lands so the eye finds the row that
 * moved. Bump `flash` to play the flash again. Key it by player so React moves the row instead of
 * re-creating it. With Reduce Motion the row lands at once and does not flash.
 */
export function LiveRow({ flash, children }: { flash: number; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const tint = useSharedValue(0);

  useEffect(() => {
    if (flash === 0 || reduceMotion) return;
    tint.value = 1;
    tint.value = withTiming(0, { duration: duration.slow, easing: ease.standard });
  }, [flash, reduceMotion, tint]);

  const tinted = useAnimatedStyle(() => ({ opacity: tint.value }));

  return (
    <ReorderRow>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, tinted]} />
      {children}
    </ReorderRow>
  );
}

const styles = StyleSheet.create({
  tint: { backgroundColor: colors.accentTint },
});
