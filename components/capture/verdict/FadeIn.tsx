import type { ReactNode } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useReduceMotion } from "@/components/motion";
import { SPRING } from "@/lib/native/motion";

type Props = { delay: number; children: ReactNode };

/** Entrance with a beat of the verdict timeline as its delay: rises on the shared spring, instant with Reduce Motion. */
export function FadeIn({ delay, children }: Props) {
  const reduceMotion = useReduceMotion();
  const entering = reduceMotion
    ? undefined
    : FadeInDown.delay(delay).springify().damping(SPRING.damping).stiffness(SPRING.stiffness).mass(SPRING.mass);
  return <Animated.View entering={entering}>{children}</Animated.View>;
}
