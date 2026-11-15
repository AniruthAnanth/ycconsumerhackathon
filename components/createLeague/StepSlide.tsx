import type { ReactNode } from "react";
import Animated, { SlideInLeft, SlideInRight } from "react-native-reanimated";

import { useReduceMotion } from "@/components/motion";
import { SPRING } from "@/lib/native/motion";

type Props = {
  /** Names the step; a new name remounts the view, which is what plays the slide. */
  step: string;
  /** Next slides the step in from the right, Back from the left. Null on the first step shown, which does not slide. */
  forward: boolean | null;
  children: ReactNode;
};

/**
 * Slides a step of the walkthrough in from the side it comes from, on the app's one spring, so
 * Next and Back read as moving along a line. With Reduce Motion the step simply appears.
 */
export function StepSlide({ step, forward, children }: Props) {
  const reduceMotion = useReduceMotion();
  const entering =
    reduceMotion || forward === null
      ? undefined
      : (forward ? SlideInRight : SlideInLeft).springify().damping(SPRING.damping).stiffness(SPRING.stiffness).mass(SPRING.mass);
  return (
    <Animated.View key={step} entering={entering}>
      {children}
    </Animated.View>
  );
}
