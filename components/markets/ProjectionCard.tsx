import { StyleSheet, Text, View } from "react-native";
import Svg from "react-native-svg";

import { CountUp } from "@/components/motion";
import { colors, fontFamily, hairline, radius, SCREEN_MARGIN, spacing, type } from "@/theme";

import { formatChance, formatNet, sparkPath } from "./chartGeometry";
import { DrawLine } from "./DrawLine";
import type { Market } from "./useMarket";

const SPARK = { width: 96, height: 40, padding: 3 };

/**
 * The week's two projections as a compact market card: the expected net payout (what settlement
 * would most likely hand back, minus the stake) with how it trended, then the projected final
 * score and its 80% range. A free league has no payout, so the score leads instead.
 */
export function ProjectionCard({ market }: { market: Market }) {
  const { payout, me } = market;
  const spark = payout.history.map(({ at, netUsd }) => ({ at, value: netUsd }));
  const d = sparkPath(spark, SPARK);
  const gaining = payout.expectedNetUsd >= 0;

  return (
    <View style={styles.card} testID="projection-card">
      {payout.eligible ? (
        <View style={styles.row} accessible accessibilityLabel={`Projected pot winnings ${formatNet(payout.expectedNetUsd)} this week, ${formatChance(payout.potChance)} to win the pot, between ${formatNet(payout.lowNetUsd)} and ${formatNet(payout.highNetUsd)}`}>
          <View style={styles.grow}>
            <Text style={styles.eyebrow}>PROJECTED WINNINGS (POT)</Text>
            <CountUp style={[styles.figure, { color: gaining ? colors.green : colors.danger }]} value={Math.round(payout.expectedNetUsd)} format={formatNet} fromZero />
            <Text style={styles.meta}>{`${formatNet(payout.lowNetUsd)} to ${formatNet(payout.highNetUsd)} · ${formatChance(payout.potChance)} to win the pot`}</Text>
          </View>
          <Svg width={SPARK.width} height={SPARK.height} accessible={false}>
            <DrawLine d={d} length={SPARK.width * 2} color={gaining ? colors.green : colors.danger} width={2} />
          </Svg>
        </View>
      ) : null}
      <View style={[styles.row, payout.eligible && styles.divided]} accessible accessibilityLabel={`Projected final score ${me.projected}, likely ${me.low} to ${me.high}`}>
        <View style={styles.grow}>
          <Text style={styles.eyebrow}>PROJECTED FINAL SCORE</Text>
          <CountUp style={payout.eligible ? styles.secondFigure : styles.figure} value={me.projected} format={(value) => String(value)} fromZero />
        </View>
        <View style={styles.range}>
          <Text style={styles.rangeText}>{`${me.low}–${me.high}`}</Text>
          <Text style={styles.meta}>{`${me.confirmed} banked`}</Text>
        </View>
      </View>
      {payout.eligible ? null : <Text style={styles.meta}>Free league: no pot to project.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN_MARGIN,
    marginTop: spacing.md,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  divided: { paddingTop: spacing.md, borderTopWidth: hairline, borderTopColor: colors.divider },
  grow: { flex: 1, gap: 2 },
  eyebrow: { ...type.caption, color: colors.textMuted, letterSpacing: 0.6 },
  figure: { ...type.title, color: colors.text, fontVariant: ["tabular-nums"] },
  secondFigure: { ...type.heading, color: colors.text, fontVariant: ["tabular-nums"] },
  range: { alignItems: "flex-end", gap: 2 },
  rangeText: { fontFamily: fontFamily.extraBold, fontSize: type.label.fontSize, color: colors.text, fontVariant: ["tabular-nums"] },
  meta: { ...type.small, color: colors.textMuted },
});
