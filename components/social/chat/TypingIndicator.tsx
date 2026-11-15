import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { colors, duration, radius, SCREEN_MARGIN, spacing } from "@/theme";

const DOT_COUNT = 3;
const STEP_MS = duration.base;

/** Three pulsing dots in the agent's bubble position while a reply is pending. */
export function TypingIndicator() {
  const dots = useRef(Array.from({ length: DOT_COUNT }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = dots.map((opacity, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * STEP_MS),
          Animated.timing(opacity, { toValue: 1, duration: STEP_MS * 2, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.3, duration: STEP_MS * 2, useNativeDriver: true }),
          Animated.delay((DOT_COUNT - 1 - i) * STEP_MS),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View style={styles.row} accessibilityLabel="League agent is typing">
      <View style={styles.bubble}>
        {dots.map((opacity, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.xs, alignItems: "flex-start" },
  bubble: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.control,
    backgroundColor: colors.strip,
  },
  dot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.textMuted },
});
