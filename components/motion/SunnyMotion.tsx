import { type ReactNode, useEffect } from "react";
import { type StyleProp, StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { duration, spring } from "@/theme";

import { ease } from "./ease";
import { useReduceMotion } from "./useReduceMotion";

/**
 * Sunny's whole motion language lives here, so the mascot moves one way on every screen: a soft
 * breathe where Sunny is the screen's focus, and one happy hop on a success event. Nothing loops
 * faster than a breath, nothing rotates, and every transform pivots at Sunny's feet (bottom centre)
 * so a squash never lifts the feet off the ground or crops the head.
 */

/** How high the hop lifts, as a share of Sunny's size, so a small and a large Sunny hop alike. */
const HOP_LIFT = 0.18;
/** One breath in and out, slow enough to read as alive rather than as motion. */
const BREATH_MS = duration.slow * 10;

/**
 * One hop with squash and stretch, played once when the component mounts (the success event that
 * mounted it) and then at rest. Returns the animated style for the view that holds Sunny.
 */
export function useSunnyHop(size: number, delay = 0) {
  const reduceMotion = useReduceMotion();
  const lift = useSharedValue(0);
  const stretch = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setTimeout(() => {
      // Anticipation squash, stretch on the way up, squash on landing, settle.
      stretch.value = withSequence(
        withTiming(0.9, { duration: duration.fast, easing: ease.standard }),
        withTiming(1.08, { duration: duration.base, easing: ease.standard }),
        withTiming(1, { duration: duration.base, easing: ease.standard }),
        withTiming(0.92, { duration: duration.fast, easing: ease.standard }),
        withSpring(1, spring.gentle),
      );
      lift.value = withSequence(
        withTiming(0, { duration: duration.fast }),
        withTiming(-size * HOP_LIFT, { duration: duration.base, easing: ease.standard }),
        withTiming(0, { duration: duration.base, easing: ease.emphasized }),
      );
    }, delay);
    return () => clearTimeout(timer);
    // The hop plays once per mount; the shared values are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scaleY: stretch.value }, { scaleX: 1 / Math.sqrt(stretch.value) }],
  }));
}

type Props = { children: ReactNode; style?: StyleProp<ViewStyle> };

/** Sunny hopping once on a success event (a proof verified, a lineup locked). */
export function SunnyHop({ children, size, delay, style }: Props & { size: number; delay?: number }) {
  const hop = useSunnyHop(size, delay);
  return <Animated.View style={[styles.feet, { paddingTop: size * HOP_LIFT }, style, hop]}>{children}</Animated.View>;
}

/** Sunny breathing softly (scale 1.00 to 1.02), only where Sunny is the screen's focus. */
export function SunnyBreathe({ children, style }: Props) {
  const reduceMotion = useReduceMotion();
  const breath = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      breath.value = 1;
      return;
    }
    breath.value = withRepeat(withTiming(1.02, { duration: BREATH_MS / 2, easing: ease.standard }), -1, true);
    return () => cancelAnimation(breath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));
  return <Animated.View style={[styles.feet, style, animated]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  // Pivot at the feet and never clip: the hop's lift and the stretch draw outside the box.
  feet: { transformOrigin: "50% 100%", overflow: "visible", alignItems: "center" },
});
