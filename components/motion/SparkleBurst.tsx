import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { interpolate, type SharedValue, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { doneMoment } from "@/theme";

import { ease } from "./ease";

type Props = {
  animate: boolean;
  color: string;
  count?: number;
  distance?: number;
  delay?: number;
};

/**
 * A small burst of sparkles flying out from the centre of whatever it sits in. One shared value
 * drives every particle on the UI thread; each particle maps it to its own angle. Renders nothing
 * unless the done sequence is playing.
 */
export function SparkleBurst({ animate, color, count = doneMoment.sparkles, distance = doneMoment.sparkleDistance, delay = 0 }: Props) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!animate) return;
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, { duration: doneMoment.burstMs, easing: ease.standard }));
  }, [animate, delay, progress]);
  if (!animate) return null;
  return (
    <View pointerEvents="none" style={styles.origin}>
      {Array.from({ length: count }, (_, index) => (
        // Half a step of offset, so no sparkle flies straight up through the title.
        <Sparkle key={index} angle={((index + 0.5) / count) * Math.PI * 2} distance={distance} color={color} progress={progress} />
      ))}
    </View>
  );
}

function Sparkle({ angle, distance, color, progress }: { angle: number; distance: number; color: string; progress: SharedValue<number> }) {
  const fly = useAnimatedStyle(() => {
    const travelled = progress.value * distance;
    return {
      opacity: interpolate(progress.value, [0, 0.05, 0.6, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * travelled },
        { translateY: Math.sin(angle) * travelled },
        { scale: interpolate(progress.value, [0, 0.3, 1], [0.4, 1, 0.5]) },
      ],
    };
  });
  return <Animated.View style={[styles.sparkle, { backgroundColor: color }, fly]} />;
}

const SIZE = doneMoment.sparkleSize;

const styles = StyleSheet.create({
  origin: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  sparkle: { position: "absolute", width: SIZE, height: SIZE, borderRadius: SIZE / 2, opacity: 0 },
});
