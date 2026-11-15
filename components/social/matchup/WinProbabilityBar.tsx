import { StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, progress, radius, SCREEN_MARGIN, spacing } from "@/theme";

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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.lg },
  percent: { width: 36, color: colors.text, fontSize: font.body, fontFamily: fontFamily.extraBold, fontVariant: ["tabular-nums"] },
  percentRight: { textAlign: "right" },
  bar: { flex: 1, height: progress.height, flexDirection: "row", borderRadius: radius.pill, overflow: "hidden", backgroundColor: progress.track },
  mine: { backgroundColor: progress.fill },
  theirs: { backgroundColor: progress.track },
});
