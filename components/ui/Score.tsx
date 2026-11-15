import { StyleSheet, Text, View } from "react-native";

import { CountUp } from "@/components/motion";

import { formatScore } from "@/lib/taskText";
import { colors, font, fontFamily } from "@/theme";

type Props = {
  /** Points earned; null until the task is verified. */
  value: number | null | undefined;
  /** Points on offer, shown in grey under the dash while unscored. */
  projected?: number;
  /** "total" is the larger figure at the foot of a roster. */
  size?: "row" | "total";
  /** Count to a new value instead of swapping digits; same look either way. */
  animated?: boolean;
};

/** A right-aligned box-score number: a dash until scored, then one decimal. */
export function Score({ value, projected, size = "row", animated = false }: Props) {
  const scored = value != null;
  const style = [size === "total" ? styles.total : styles.row, !scored && styles.unscored];
  return (
    <View style={styles.box}>
      {animated && scored ? (
        <CountUp style={style} value={value} format={formatScore} decimals={1} />
      ) : (
        <Text style={style}>{formatScore(value)}</Text>
      )}
      {!scored && projected != null ? <Text style={styles.projected}>{projected.toFixed(1)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { minWidth: 48, alignItems: "flex-end" },
  row: { fontSize: font.score, fontFamily: fontFamily.bold, color: colors.text, fontVariant: ["tabular-nums"] },
  total: { fontSize: font.total, fontFamily: fontFamily.extraBold, color: colors.text, fontVariant: ["tabular-nums"] },
  unscored: { color: colors.textFaint },
  projected: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted, fontVariant: ["tabular-nums"] },
});
