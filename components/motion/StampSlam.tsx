import { type ReactNode, useEffect } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";

import { STAMP_DROP_MS, STAMP_SETTLE_MS } from "@/lib/native/motion";
import { duration } from "@/theme";

import { ease } from "./ease";

import { useReduceMotion } from "./useReduceMotion";

type Props = {
  children: ReactNode;
  /** Wait before the slam, so it lands on a beat of the reveal. */
  delay?: number;
  /** Called the moment it lands, for the haptic thud. Runs even with Reduce Motion on. */
  onLand?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Slams its child down from above full size, overshoots to slightly under, and settles: the
 * referee's rubber stamp hitting the page, in one slow beat. With Reduce Motion it appears in place.
 */
export function StampSlam({ children, delay = 0, onLand, style }: Props) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 2.4);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1;
      opacity.value = 1;
      const timer = setTimeout(() => onLand?.(), delay);
      return () => clearTimeout(timer);
    }
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(0.92, { duration: STAMP_DROP_MS, easing: ease.emphasized }),
        withTiming(1, { duration: STAMP_SETTLE_MS, easing: ease.standard }),
      ),
    );
    opacity.value = withDelay(delay, withTiming(1, { duration: duration.fast, easing: ease.standard }));
    // The thud belongs to the frame the stamp touches down, not to when it started falling.
    const timer = setTimeout(() => onLand?.(), delay + STAMP_DROP_MS);
    return () => clearTimeout(timer);
    // onLand is a callback prop; re-running the slam when a parent re-renders would replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
