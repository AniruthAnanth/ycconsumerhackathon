import { usePathname } from "expo-router";
import { type ReactNode, useState } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { SPRING, staggerDelay } from "@/lib/native/motion";

import { firstLoad } from "./firstLoad";
import { useReduceMotion } from "./useReduceMotion";

/**
 * Rises and fades its child in, index steps after the first block, so a screen builds top to
 * bottom the first time it loads. Only a screen's first load animates: coming back to it (a tab
 * switch, a back navigation) or data arriving later leaves everything in place, because a cascade
 * on every visit is decoration, not meaning. With Reduce Motion it appears at once.
 */
export function Entrance({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReduceMotion();
  const path = usePathname();
  const [animate] = useState(() => firstLoad(path, Date.now()));
  const entering =
    reduceMotion || !animate
      ? undefined
      : FadeInDown.delay(staggerDelay(index)).springify().damping(SPRING.damping).stiffness(SPRING.stiffness).mass(SPRING.mass);
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
