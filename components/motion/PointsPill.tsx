import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring } from "react-native-reanimated";

import { formatGain } from "@/lib/taskDone";
import { colors, doneMoment, font, fontFamily, layout, radius, spacing, spring, tabular } from "@/theme";

/** A done task's points, "+30" in bold green on a soft green pill. Beat 3 pops it in past full size. */
export function PointsPill({ points, animate }: { points: number; animate: boolean }) {
  const scale = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) {
      scale.value = 1;
      return;
    }
    scale.value = 0;
    scale.value = withDelay(doneMoment.pillDelayMs, withSequence(withSpring(doneMoment.pillPeak, spring.snappy), withSpring(1, spring.gentle)));
  }, [animate, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.pill, pop]}>
      <Text style={styles.text}>{formatGain(points)}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { height: layout.pillHeight, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.accentTint, justifyContent: "center" },
  text: { fontFamily: fontFamily.extraBold, fontSize: font.meta, color: colors.accent, ...tabular },
});
