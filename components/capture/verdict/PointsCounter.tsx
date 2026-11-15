import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

import { colors } from "@/theme";

import { countedPoints, formatPoints } from "./formatPoints";
import { COUNT_UP_MS } from "./timing";

type Props = { points: number; pass: boolean; delay: number };

/** The score, counting up from zero on a pass and a plain dash on a fail. */
export function PointsCounter({ points, pass, delay }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!pass) return;
    const id = progress.addListener(({ value }) => setShown(countedPoints(points, value)));
    Animated.timing(progress, { toValue: 1, duration: COUNT_UP_MS, delay, useNativeDriver: false }).start();
    return () => progress.removeListener(id);
  }, [delay, pass, points, progress]);

  return <Text style={styles.value}>{formatPoints(shown, pass)}</Text>;
}

const styles = StyleSheet.create({
  value: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
});
