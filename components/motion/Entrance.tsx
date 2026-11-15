import type { ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { SPRING, staggerDelay } from "@/lib/native/motion";

import { useReduceMotion } from "./useReduceMotion";

/**
 * Rises and fades its child in when it first mounts, index steps after the first block, so a
 * screen builds top to bottom instead of popping in at once. Only the first mount animates; a
 * re-render or data update leaves it in place. With Reduce Motion it appears at once.
 */
export function Entrance({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReduceMotion();
  const entering = reduceMotion
    ? undefined
    : FadeInDown.delay(staggerDelay(index)).springify().damping(SPRING.damping).stiffness(SPRING.stiffness).mass(SPRING.mass);
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
