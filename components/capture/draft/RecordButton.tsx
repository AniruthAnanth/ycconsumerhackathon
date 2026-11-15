import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, spacing } from "@/theme";

import { formatElapsed } from "./recordingMeter";

const SIZE = 112;
const PULSE_SIZE = 168;
/** The timer and the hint share one line, so the screen does not jump when recording starts. */
const CAPTION_HEIGHT = 22;

type Props = {
  recording: boolean;
  disabled: boolean;
  durationMillis: number;
  level: number;
  onPress: () => void;
};

export function RecordButton({ recording, disabled, durationMillis, level, onPress }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(pulse, { toValue: recording ? level : 0, duration: 100, useNativeDriver: true }).start();
  }, [pulse, recording, level]);

  return (
    <View style={styles.container}>
      <View style={styles.stage}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulse,
            { opacity: recording ? 0.18 : 0, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recording ? "Stop recording" : "Start recording"}
          disabled={disabled}
          onPress={onPress}
          style={[styles.ring, disabled && styles.disabled]}
        >
          <View style={recording ? styles.stopSquare : styles.recordDot} />
        </Pressable>
      </View>
      {recording ? (
        <Text style={styles.timer}>{formatElapsed(durationMillis)}</Text>
      ) : (
        // A bare circle does not say it listens. Nothing to tap while a draft is on its way.
        <Text style={styles.hint}>{disabled ? " " : "Tap to talk"}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center" },
  stage: { width: PULSE_SIZE, height: PULSE_SIZE, alignItems: "center", justifyContent: "center" },
  pulse: {
    position: "absolute",
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    backgroundColor: colors.accent,
  },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
  recordDot: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accent },
  stopSquare: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.accent },
  timer: { marginTop: spacing.sm, minHeight: CAPTION_HEIGHT, fontSize: font.header, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  hint: { marginTop: spacing.sm, minHeight: CAPTION_HEIGHT, fontSize: font.body, color: colors.textMuted },
});
