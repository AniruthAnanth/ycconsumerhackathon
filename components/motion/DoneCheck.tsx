import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";

import { SymbolIcon } from "@/lib/native/SymbolIcon";
import { colors, doneMoment, spring } from "@/theme";

const SIZE = 18;

/** The small green check before a done task's points. Beat 1 of the done sequence springs it in past full size. */
export function DoneCheck({ animate }: { animate: boolean }) {
  const scale = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) {
      scale.value = 1;
      return;
    }
    scale.value = 0;
    scale.value = withSequence(withSpring(doneMoment.checkPeak, spring.snappy), withSpring(1, spring.gentle));
  }, [animate, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.circle, pop]} testID="done-check">
      <SymbolIcon ios="checkmark" fallback="checkmark" size={SIZE - 6} color={colors.onAccent} weight="bold" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
});
