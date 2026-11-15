import type { ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

import { spring } from "@/theme";

import { useReduceMotion } from "./useReduceMotion";

const slide = LinearTransition.springify().damping(spring.gentle.damping).stiffness(spring.gentle.stiffness).mass(spring.gentle.mass);

/**
 * A list row that slides to its new place when the list reorders (a standings change), instead
 * of jumping. Give it a stable key (the player's id) so React moves the row rather than
 * re-creating it. With Reduce Motion it moves without animating.
 */
export function ReorderRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReduceMotion();
  return (
    <Animated.View layout={reduceMotion ? undefined : slide} style={style}>
      {children}
    </Animated.View>
  );
}
