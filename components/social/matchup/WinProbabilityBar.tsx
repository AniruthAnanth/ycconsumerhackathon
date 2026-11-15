import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { useReduceMotion } from "@/components/motion";
import { colors, fontFamily, progress, radius, spacing, spring, type } from "@/theme";

import { winBarSplit } from "./matchupLogic";

/**
 * The two win chances over one bar. It opens on the current split, then springs to each new one
 * as a verified proof moves the odds; with Reduce Motion it lands at once.
 */
export function WinProbabilityBar({ mine, theirs }: { mine: number; theirs: number }) {
  const { mineShare, minePercent, theirsPercent } = winBarSplit(mine, theirs);
  const reduceMotion = useReduceMotion();
  const shown = useSharedValue(mineShare);
  useEffect(() => {
    shown.value = reduceMotion ? mineShare : withSpring(mineShare, spring.gentle);
  }, [mineShare, reduceMotion, shown]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.min(Math.max(shown.value, 0), 1) * 100}%` }));

  return (
    <View style={styles.wrap}>
      <View style={styles.labels}>
        <Text style={styles.percent}>{minePercent}%</Text>
        <Text style={styles.caption}>Win this matchup</Text>
        <Text style={styles.percent}>{theirsPercent}%</Text>
      </View>
      <View style={styles.track} accessible={false} importantForAccessibility="no-hide-descendants">
        <Animated.View style={[styles.fill, fill]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  labels: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  percent: { ...type.heading, color: colors.text, fontVariant: ["tabular-nums"] },
  caption: { color: colors.textFaint, fontFamily: fontFamily.semiBold, fontSize: type.caption.fontSize },
  track: { height: progress.height, borderRadius: radius.pill, overflow: "hidden", backgroundColor: progress.track },
  fill: { height: "100%", borderRadius: radius.pill, backgroundColor: progress.fill },
});
