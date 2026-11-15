import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { CountUp } from "@/components/motion";
import { colors, fontFamily, radius, SCREEN_MARGIN, spacing, type } from "@/theme";

import { areaPath, deltaLabel, formatChance, stepPath } from "./chartGeometry";
import { DrawLine } from "./DrawLine";
import type { Market } from "./useMarket";

const CHART_HEIGHT = 120;

/**
 * "62% to win": the matchup priced like a prediction market. The chance is the headline, the
 * chip says how far it moved today, and the step chart shows every verified proof as a trade
 * that moved the price.
 */
export function WinProbChart({ matchup }: { matchup: NonNullable<Market["matchup"]> }) {
  const [width, setWidth] = useState(0);
  const box = { width, height: CHART_HEIGHT, padding: 6 };
  const points = matchup.history.map(({ at, chance }) => ({ at, value: chance }));
  const line = stepPath(points, box);
  const up = matchup.deltaToday >= 0;
  const percent = Math.round(matchup.chance * 100);

  return (
    <View style={styles.card} testID="win-prob-chart">
      <Text style={styles.eyebrow}>{`WIN PROBABILITY · VS ${matchup.opponentName.toUpperCase()}`}</Text>
      <View style={styles.headline} accessible accessibilityLabel={`${percent}% chance to beat ${matchup.opponentName}, ${deltaLabel(matchup.deltaToday)}`}>
        <CountUp style={styles.figure} value={percent} format={(value) => `${value}%`} fromZero />
        <Text style={styles.toWin}>to win</Text>
        <View style={[styles.chip, up ? styles.chipUp : styles.chipDown]}>
          <Text style={[styles.chipText, { color: up ? colors.green : colors.danger }]}>{deltaLabel(matchup.deltaToday)}</Text>
        </View>
      </View>
      <View style={styles.chart} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} accessible={false} importantForAccessibility="no-hide-descendants">
        {width > 0 ? (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="winFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.green} stopOpacity={0.16} />
                <Stop offset="1" stopColor={colors.green} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {/* The even-money line: above it the matchup is yours to lose. */}
            <Line x1={0} x2={width} y1={CHART_HEIGHT / 2} y2={CHART_HEIGHT / 2} stroke={colors.divider} strokeDasharray={[4, 4]} />
            <Path d={areaPath(line, box)} fill="url(#winFill)" />
            <DrawLine d={line.d} length={line.length} color={colors.green} />
            <Circle cx={line.end.x} cy={line.end.y} r={4.5} fill={colors.green} stroke={colors.surface} strokeWidth={2} />
          </Svg>
        ) : null}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>Mon</Text>
        <Text style={styles.axisText}>{`${matchup.history.length - 1} proofs · 50% line`}</Text>
        <Text style={styles.axisText}>Now</Text>
      </View>
      <Text style={styles.footnote}>{`${formatChance(1 - matchup.chance)} ${matchup.opponentName}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN_MARGIN,
    marginTop: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  eyebrow: { ...type.caption, color: colors.textMuted, letterSpacing: 0.6 },
  headline: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, flexWrap: "wrap" },
  figure: { ...type.title, color: colors.text, fontVariant: ["tabular-nums"] },
  toWin: { ...type.subheading, color: colors.textMuted },
  chip: { marginLeft: "auto", alignSelf: "center", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  chipUp: { backgroundColor: colors.lime },
  chipDown: { backgroundColor: colors.play },
  chipText: { fontFamily: fontFamily.extraBold, fontSize: type.small.fontSize, fontVariant: ["tabular-nums"] },
  chart: { height: CHART_HEIGHT, marginTop: spacing.xs },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  axisText: { ...type.caption, color: colors.textFaint },
  footnote: { ...type.small, color: colors.textMuted },
});
