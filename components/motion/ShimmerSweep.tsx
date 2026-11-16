import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { colors, doneMoment } from "@/theme";

import { ease } from "./ease";

/** The band's width, as a share of the row. */
const BAND = 30;

/** Beat 5, the perfect week: one band of light sweeps across the row. Sits over the row and never takes a touch. */
export function ShimmerSweep({ animate }: { animate: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!animate) return;
    progress.value = 0;
    progress.value = withDelay(doneMoment.shimmerDelayMs, withTiming(1, { duration: doneMoment.shimmerMs, easing: ease.standard }));
  }, [animate, progress]);
  const sweep = useAnimatedStyle(() => ({ left: `${-BAND + progress.value * (100 + BAND)}%` }));
  if (!animate) return null;
  return (
    <View pointerEvents="none" style={styles.clip}>
      <Animated.View style={[styles.band, sweep]} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  band: { position: "absolute", top: 0, bottom: 0, width: `${BAND}%`, backgroundColor: colors.shimmer, transform: [{ skewX: "-20deg" }] },
});
