import { StyleSheet, Text } from "react-native";

import { CountUp } from "@/components/motion";
import { colors } from "@/theme";

import { formatPoints } from "./formatPoints";

type Props = { points: number; pass: boolean; delay: number };

/** The score, counting up from zero on a pass (COUNT_MS, under 400 ms) and a plain dash on a fail. */
export function PointsCounter({ points, pass, delay }: Props) {
  if (!pass) return <Text style={styles.value}>{formatPoints(points, false)}</Text>;
  return (
    <CountUp
      value={points}
      format={(shown) => formatPoints(shown, true)}
      decimals={1}
      fromZero
      delay={delay}
      style={styles.value}
    />
  );
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
