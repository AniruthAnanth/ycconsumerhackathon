import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { BORDER, colors, fontFamily, radius, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import { areaPath, deltaPoints, formatChance, stepPath } from "./chartGeometry";
import { DrawLine } from "./DrawLine";
import type { Market } from "./useMarket";

const CHART_HEIGHT = 120;
const AXIS_WIDTH = 40;
type Range = "day" | "week";

/**
 * Your chance to win the matchup over time, drawn like a market's price chart: a fixed 0 to 100%
 * axis with a 50% midline, a step at every verified proof, and the latest value labelled at the
 * dot. 1D shows today only; 1W the whole week.
 */
export function WinProbChart({ matchup }: { matchup: NonNullable<Market["matchup"]> }) {
  const [width, setWidth] = useState(0);
  const [range, setRange] = useState<Range>("week");
  const plotWidth = Math.max(0, width - AXIS_WIDTH);
  const box = { width: plotWidth, height: CHART_HEIGHT, padding: 6 };
  const all = matchup.history.map(({ at, chance }) => ({ at, value: chance }));
  // Today starts from the last price set before midnight, so the line opens where yesterday closed.
  const todayStart = matchup.todayStart ?? all[0]?.at ?? 0;
  const before = all.filter((point) => point.at < todayStart).pop();
  const today = all.filter((point) => point.at >= todayStart);
  const points = range === "week" ? all : [...(before ? [{ ...before, at: todayStart }] : []), ...today];
  const line = stepPath(points.length ? points : all.slice(-1), box);
  const y = (value: number) => box.padding + (1 - value) * (CHART_HEIGHT - 2 * box.padding);
  const up = matchup.deltaToday >= 0;

  return (
    <View style={styles.card} testID="win-prob-chart">
      <View style={styles.head}>
        <View style={styles.grow}>
          <Text style={styles.title}>Your chance to win</Text>
          <Text style={[styles.delta, { color: up ? colors.green : colors.danger }]} accessibilityLabel={`${up ? "Up" : "Down"} ${Math.abs(matchup.deltaToday)} percent since yesterday`}>
            {deltaPoints(matchup.deltaToday)}
            <Text style={styles.since}> since yesterday</Text>
          </Text>
        </View>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(["day", "week"] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => setRange(option)}
              style={[styles.tab, range === option && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: range === option }}
              hitSlop={8}
            >
              <Text style={[styles.tabText, range === option && styles.tabTextOn]}>{option === "day" ? "1D" : "1W"}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.chart} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} accessible={false} importantForAccessibility="no-hide-descendants">
        {plotWidth > 0 ? (
          <>
            <Svg width={plotWidth} height={CHART_HEIGHT}>
              <Defs>
                <LinearGradient id="winFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.green} stopOpacity={0.16} />
                  <Stop offset="1" stopColor={colors.green} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Line x1={0} x2={plotWidth} y1={y(0.5)} y2={y(0.5)} stroke={colors.divider} strokeDasharray={[4, 4]} />
              <Path d={areaPath(line, box)} fill="url(#winFill)" />
              <DrawLine key={range} d={line.d} length={line.length} color={colors.green} />
              <Circle cx={line.end.x} cy={line.end.y} r={4.5} fill={colors.green} stroke={colors.surface} strokeWidth={2} />
            </Svg>
            <View style={styles.yAxis}>
              <Text style={[styles.axisText, { top: y(1) - 8 }]}>100%</Text>
              <Text style={[styles.axisText, { top: y(0.5) - 8 }]}>50%</Text>
              <Text style={[styles.axisText, { top: y(0) - 8 }]}>0%</Text>
            </View>
            <View style={[styles.dotLabel, { left: Math.min(line.end.x - 20, plotWidth - 44), top: line.end.y < 30 ? line.end.y + 8 : line.end.y - 28 }]}>
              <Text style={styles.dotText}>{formatChance(matchup.chance)}</Text>
            </View>
          </>
        ) : null}
      </View>
      <View style={[styles.xAxis, { marginRight: AXIS_WIDTH }]}>
        <Text style={styles.xText}>{range === "week" ? "Mon" : "Midnight"}</Text>
        <Text style={styles.xText}>Now</Text>
      </View>
      <Text style={styles.caption}>Updated after every proof.</Text>
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
    borderWidth: BORDER,
    borderColor: colors.divider,
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  grow: { flex: 1, gap: 2 },
  title: { ...type.subheading, color: colors.text },
  delta: { fontFamily: fontFamily.bold, fontSize: type.small.fontSize, ...tabular },
  since: { ...type.caption, color: colors.textFaint },
  tabs: { flexDirection: "row", gap: spacing.xs },
  tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  tabOn: { backgroundColor: colors.accentTint },
  tabText: { ...type.label, color: colors.textMuted },
  tabTextOn: { color: colors.green },
  chart: { height: CHART_HEIGHT, marginTop: spacing.xs },
  yAxis: { position: "absolute", right: 0, top: 0, bottom: 0, width: AXIS_WIDTH },
  axisText: { position: "absolute", right: 0, ...type.caption, color: colors.textFaint, ...tabular },
  dotLabel: { position: "absolute", paddingHorizontal: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.green },
  dotText: { fontFamily: fontFamily.extraBold, fontSize: type.small.fontSize, color: colors.onAccent, ...tabular },
  xAxis: { flexDirection: "row", justifyContent: "space-between" },
  xText: { ...type.caption, color: colors.textFaint },
  caption: { ...type.small, color: colors.textMuted },
});
