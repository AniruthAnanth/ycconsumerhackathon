import { StyleSheet, Text, View } from "react-native";

import { formatScore } from "@/lib/taskText";
import { colors, font } from "@/theme";

type Props = {
  /** Points earned; null until the task is verified. */
  value: number | null | undefined;
  /** Points on offer, shown in grey under the dash while unscored. */
  projected?: number;
  /** "total" is the larger figure at the foot of a roster. */
  size?: "row" | "total";
};

/** A right-aligned box-score number: a dash until scored, then one decimal. */
export function Score({ value, projected, size = "row" }: Props) {
  const scored = value != null;
  return (
    <View style={styles.box}>
      <Text style={[size === "total" ? styles.total : styles.row, !scored && styles.unscored]}>{formatScore(value)}</Text>
      {!scored && projected != null ? <Text style={styles.projected}>{projected.toFixed(1)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { minWidth: 48, alignItems: "flex-end" },
  row: { fontSize: font.score, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  total: { fontSize: font.total, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  unscored: { color: colors.textFaint },
  projected: { fontSize: font.meta, color: colors.textMuted, fontVariant: ["tabular-nums"] },
});
