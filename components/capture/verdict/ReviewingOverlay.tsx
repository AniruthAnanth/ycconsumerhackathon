import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import ReAnimated, { Easing as ReEasing, FadeOut } from "react-native-reanimated";

import { useReduceMotion } from "@/components/motion";
import { FADE_MS } from "@/lib/native/motion";
import { colors, fontFamily, spacing } from "@/theme";

const BAND_HEIGHT = 48;

type Props = { title: string };

/** A scan line sweeping the proof while the referee looks at it. */
export function ReviewingOverlay({ title }: Props) {
  const reduceMotion = useReduceMotion();
  const [height, setHeight] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const translateY = sweep.interpolate({ inputRange: [0, 1], outputRange: [-BAND_HEIGHT, height] });

  return (
    <ReAnimated.View
      exiting={reduceMotion ? undefined : FadeOut.duration(FADE_MS).easing(ReEasing.out(ReEasing.cubic))}
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
      <Animated.View style={[styles.band, { transform: [{ translateY }] }]}>
        <View style={styles.line} />
      </Animated.View>
      <View style={styles.caption}>
        <Text style={styles.label}>REFEREE REVIEWING</Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      </View>
    </ReAnimated.View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BAND_HEIGHT,
    justifyContent: "flex-end",
    backgroundColor: "rgba(21, 92, 64, 0.16)",
  },
  line: { height: 2, backgroundColor: colors.accent },
  caption: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  label: { color: colors.white, fontSize: 11, fontFamily: fontFamily.bold, letterSpacing: 1.6 },
  title: { color: colors.white, fontSize: 20, fontFamily: fontFamily.bold, marginTop: spacing.xs },
});
