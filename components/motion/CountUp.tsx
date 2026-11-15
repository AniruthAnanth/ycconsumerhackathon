import { useEffect, useRef, useState } from "react";
import { Text, type TextProps } from "react-native";

import { COUNT_MS, countValue } from "@/lib/native/motion";

import { useReduceMotion } from "./useReduceMotion";

type Props = Omit<TextProps, "children"> & {
  value: number;
  /** Turns the number shown into text, for example formatScore or formatUsd. */
  format: (value: number) => string;
  /** Digits kept while counting, so 12.5 counts through tenths and $40 through whole dollars. */
  decimals?: number;
  /** Count from zero on first mount instead of showing the value at once. */
  fromZero?: boolean;
  delay?: number;
};

/**
 * A number that counts to its new value when it changes, as a scoreboard does, instead of
 * swapping digits. The first render shows the value as it is unless fromZero is set, so a list
 * opening on the screen doesn't spin every figure.
 */
export function CountUp({ value, format, decimals = 0, fromZero = false, delay = 0, ...textProps }: Props) {
  const reduceMotion = useReduceMotion();
  const [shown, setShown] = useState(fromZero ? 0 : value);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    if (reduceMotion || from === value) {
      setShown(value);
      return;
    }
    let frame = 0;
    let start: number | undefined;
    const timer = setTimeout(() => {
      const step = (now: number) => {
        start ??= now;
        const next = countValue(from, value, now - start, COUNT_MS, decimals);
        setShown(next);
        if (next !== value) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [decimals, delay, reduceMotion, value]);

  return <Text {...textProps}>{format(shown)}</Text>;
}
