import { useEffect, useRef } from "react";
import { type StyleProp, StyleSheet, Text, type TextStyle, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { haptics } from "@/lib/native/haptics";
import { tickTimes } from "@/lib/taskDone";
import { doneMoment } from "@/theme";

import { ease } from "./ease";
import { useReduceMotion } from "./useReduceMotion";

type Props = {
  value: number;
  /** Turns the number into text, for example formatScore. */
  format: (value: number) => string;
  /** Must set lineHeight: each digit rolls through a window exactly one line tall. */
  style: StyleProp<TextStyle>;
  /** A soft haptic tick per step while it rolls up, at most doneMoment.maxTicks. */
  ticks?: boolean;
  delay?: number;
};

/** Three runs of 0 to 9, so a digit can roll up or down past a wrap without running out of column. */
const COLUMN = Array.from({ length: 30 }, (_, index) => index % 10);

/**
 * A scoreboard number whose digits roll to the new value, like an odometer, instead of swapping.
 * Each digit is a column translated on the UI thread, so a roll costs no React render per frame.
 * The first render shows the value as it is; only a change rolls.
 */
export function RollingNumber({ value, format, style, ticks = false, delay = doneMoment.rollDelayMs }: Props) {
  const reduceMotion = useReduceMotion();
  const text = format(value);
  const previous = useRef(value);
  const lineHeight = StyleSheet.flatten(style)?.lineHeight ?? 0;

  useEffect(() => {
    const delta = value - previous.current;
    previous.current = value;
    if (!ticks || reduceMotion || delta <= 0) return;
    const timers = tickTimes(delta, doneMoment.rollMs, doneMoment.maxTicks).map((at) => setTimeout(haptics.tick, delay + at));
    return () => timers.forEach(clearTimeout);
  }, [delay, reduceMotion, ticks, value]);

  const rising = value >= previous.current;
  return (
    <View style={styles.row} accessible accessibilityLabel={text}>
      {[...text].map((char, index) => {
        const digit = Number(char);
        if (char === " " || Number.isNaN(digit)) {
          return (
            <Text key={`mark-${text.length - index}`} style={style}>
              {char}
            </Text>
          );
        }
        return (
          <Digit
            key={`digit-${text.length - index}`}
            to={digit}
            rising={rising}
            animate={!reduceMotion}
            delay={delay}
            lineHeight={lineHeight}
            style={style}
          />
        );
      })}
    </View>
  );
}

type DigitProps = { to: number; rising: boolean; animate: boolean; delay: number; lineHeight: number; style: StyleProp<TextStyle> };

/**
 * One digit's window. It keys on its place from the right, so 9 to 10 rolls the units and adds a
 * tens column, and it remembers its own last digit so a parent render mid-roll never restarts it.
 */
function Digit({ to, rising, animate, delay, lineHeight, style }: DigitProps) {
  const position = useSharedValue(10 + to);
  const last = useRef(to);
  useEffect(() => {
    const from = last.current;
    last.current = to;
    // Start in the middle run, then roll forward (or back) through the wrap rather than the long way round.
    const target = 10 + to + (rising && to < from ? 10 : !rising && to > from ? -10 : 0);
    if (!animate || from === to) {
      position.value = 10 + to;
      return;
    }
    position.value = 10 + from;
    position.value = withDelay(delay, withTiming(target, { duration: doneMoment.rollMs, easing: ease.standard }));
    // Only a new digit rolls; rising and the delay are read as they were when it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);
  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: -position.value * lineHeight }] }));
  return (
    <View style={[styles.window, { height: lineHeight }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View style={roll}>
        {COLUMN.map((digit, index) => (
          <Text key={index} style={style}>
            {digit}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  window: { overflow: "hidden" },
});
