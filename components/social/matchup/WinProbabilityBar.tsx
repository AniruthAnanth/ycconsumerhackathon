import { StyleSheet, Text, View } from "react-native";

import { colors } from "../kit";
import { winBarSplit } from "./matchupLogic";

export function WinProbabilityBar({ mine, theirs }: { mine: number; theirs: number }) {
  const { mineShare, minePercent, theirsPercent } = winBarSplit(mine, theirs);
  return (
    <View style={styles.row}>
      <Text style={styles.percent}>{minePercent}%</Text>
      <View style={styles.bar}>
        <View style={[styles.mine, { flex: mineShare }]} />
        <View style={[styles.theirs, { flex: 1 - mineShare }]} />
      </View>
      <Text style={[styles.percent, styles.percentRight]}>{theirsPercent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 16 },
  percent: { width: 36, color: colors.text, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
  percentRight: { textAlign: "right" },
  bar: { flex: 1, height: 8, flexDirection: "row", borderRadius: 4, overflow: "hidden" },
  mine: { backgroundColor: colors.accent },
  theirs: { backgroundColor: colors.hairline },
});
