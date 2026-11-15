import { useEffect } from "react";
import { type SharedValue, cancelAnimation, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";

import { ease, useReduceMotion } from "@/components/motion";
import { duration } from "@/theme";

type Options = {
  /** Wait before the beat starts, built from motion tokens. */
  delay?: number;
  /** How long the beat takes; defaults to the base duration. */
  length?: number;
  /** Rise to 1 and fall back to 0 (a flash or a pulse) instead of settling at 1. */
  pulse?: boolean;
};

/**
 * One step of an intro sequence as a 0 to 1 shared value. It rests at its final state (1, or 0 for
 * a pulse) while the card is off screen or Reduce Motion is on, and restarts from the beginning
 * each time `playing` turns true.
 */
export function useBeat(playing: boolean, { delay = 0, length = duration.base, pulse = false }: Options = {}): SharedValue<number> {
  const reduceMotion = useReduceMotion();
  const rest = pulse ? 0 : 1;
  const value = useSharedValue(rest);
  useEffect(() => {
    cancelAnimation(value);
    if (!playing || reduceMotion) {
      value.value = rest;
      return;
    }
    value.value = 0;
    const timing = { duration: length, easing: ease.standard };
    value.value = withDelay(delay, pulse ? withSequence(withTiming(1, timing), withTiming(0, timing)) : withTiming(1, timing));
  }, [playing, reduceMotion, delay, length, pulse, rest, value]);
  return value;
}
