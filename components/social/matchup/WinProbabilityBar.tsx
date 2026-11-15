import { StyleSheet, Text, View } from "react-native";

import { ProgressFill } from "@/components/motion";
import { colors, fontFamily, spacing, type } from "@/theme";

import { winBarSplit } from "./matchupLogic";

export function WinProbabilityBar({ mine, theirs }: { mine: number; theirs: number }) {
  const { mineShare, minePercent, theirsPercent } = winBarSplit(mine, theirs);
  return (
    <View style={styles.wrap}>
      <View style={styles.labels}>
        <Text style={styles.percent}>{minePercent}%</Text>
        <Text style={styles.caption}>Win this matchup</Text>
        <Text style={styles.percent}>{theirsPercent}%</Text>
      </View>
      <ProgressFill ratio={mineShare} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  labels: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  percent: { ...type.heading, color: colors.text, fontVariant: ["tabular-nums"] },
  caption: { color: colors.textFaint, fontFamily: fontFamily.semiBold, fontSize: type.caption.fontSize },
});
