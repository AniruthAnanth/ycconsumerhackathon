import { StyleSheet } from "react-native";

import { CountUp } from "@/components/motion";
import { colors, type } from "@/theme";

import { formatPoints } from "./formatPoints";

type Props = { points: number; delay: number };

/** The score, counting up from zero on a pass (COUNT_MS, under 400 ms). */
export function PointsCounter({ points, delay }: Props) {
  return (
    <CountUp
      value={points}
      format={formatPoints}
      decimals={1}
      fromZero
      delay={delay}
      style={styles.value}
    />
  );
}

const styles = StyleSheet.create({
  value: {
    ...type.display,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
});
