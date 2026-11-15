import { useEffect } from "react";
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { Path } from "react-native-svg";

import { MAX_MOTION_MS } from "@/lib/native/motion";
import { useReduceMotion } from "@/components/motion";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * A path that draws itself on from left to right when it first mounts or its shape changes, the
 * way a price chart fills in. Reduce Motion shows it whole at once.
 */
export function DrawLine({ d, length, color, width = 2.5 }: { d: string; length: number; color: string; width?: number }) {
  const reduceMotion = useReduceMotion();
  const hidden = useSharedValue(reduceMotion ? 0 : length);
  useEffect(() => {
    if (reduceMotion) {
      hidden.value = 0;
      return;
    }
    hidden.value = length;
    hidden.value = withTiming(0, { duration: MAX_MOTION_MS * 2, easing: Easing.out(Easing.cubic) });
  }, [d, hidden, length, reduceMotion]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: hidden.value }));
  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      strokeDasharray={[Math.max(length, 1), Math.max(length, 1)]}
      animatedProps={animatedProps}
    />
  );
}
