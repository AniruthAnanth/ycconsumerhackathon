import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { useReduceMotion } from "@/components/motion";
import { colors, font, fontFamily, MIN_TARGET, spacing, tabular, type } from "@/theme";

import { formatElapsed } from "../proofKinds";

type Props = { elapsedMs: number; targetMinutes: number; frameCount: number | null; onStop: () => void };

/** The whole UI while a timelapse records: little to draw, so it suits a dimmed screen. */
export function RecordingPanel({ elapsedMs, targetMinutes, frameCount, onStop }: Props) {
  const reduceMotion = useReduceMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const reached = elapsedMs >= targetMinutes * 60_000;
  return (
    <View style={styles.panel} testID="timelapse-recording">
      <View style={styles.timerRow}>
        <Animated.View style={[styles.dot, { opacity: pulse }]} />
        <Text style={styles.timer}>{formatElapsed(elapsedMs)}</Text>
      </View>
      <Text style={styles.target} testID="camera-timelapse-status">
        {reached ? "Target reached. Stop when you're done." : `Keep going: ${targetMinutes} min target`}
        {frameCount !== null ? ` · ${frameCount} shots` : ""}
      </Text>
      <Pressable onPress={onStop} accessibilityRole="button" accessibilityLabel="Stop recording" style={styles.stop} testID="timelapse-stop">
        <View style={styles.stopSquare} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
  timerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger },
  timer: { ...type.title, color: colors.onAccent, ...tabular },
  target: { color: colors.onAccent, fontFamily: fontFamily.regular, fontSize: font.body, opacity: 0.8 },
  stop: {
    width: 72,
    height: 72,
    minHeight: MIN_TARGET,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.onAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  stopSquare: { width: 28, height: 28, borderRadius: 6, backgroundColor: colors.danger },
});
