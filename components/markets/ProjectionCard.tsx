import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg from "react-native-svg";

import { Icon } from "@/components/ui";
import { BORDER, colors, fontFamily, hairline, radius, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import { formatChance, formatNet, sparkPath } from "./chartGeometry";
import { DrawLine } from "./DrawLine";
import { potNeedsLine } from "./marketQuestions";
import type { Market } from "./useMarket";

const SPARK = { width: 96, height: 36, padding: 3 };

/**
 * Money first, the way a market quotes a payout: what you take home if you win the pot, and what
 * you're on track for now. The ranges, the trend and the chance to clear all five sit behind
 * Details, so a first-time player reads one line.
 */
export function ProjectionCard({ market, slotsCleared }: { market: Market; slotsCleared?: number }) {
  const [open, setOpen] = useState(false);
  const { payout, me } = market;
  const finish = market.odds.rows.find((row) => row.isMe)?.finishChance ?? 0;
  const spark = sparkPath(payout.history.map(({ at, netUsd }) => ({ at, value: netUsd })), SPARK);

  return (
    <View style={styles.card} testID="projection-card">
      {payout.eligible ? (
        <View style={styles.money} accessible accessibilityLabel={`If you win the pot: ${formatNet(payout.highNetUsd)}. On track for: ${formatNet(payout.expectedNetUsd)}`}>
          <View style={styles.cell}>
            <Text style={styles.label}>If you win the pot</Text>
            <Text style={styles.figure}>{formatNet(payout.highNetUsd)}</Text>
          </View>
          <View style={[styles.cell, styles.cellEnd]}>
            <Text style={styles.label}>On track for</Text>
            <Text style={[styles.figure, { color: payout.expectedNetUsd < 0 ? colors.textMuted : colors.green }]}>{formatNet(payout.expectedNetUsd)}</Text>
          </View>
        </View>
      ) : null}
      {/* Winning the matchup and winning the pot are different races; this says why the money can lag a big win chance. */}
      {payout.eligible ? (
        slotsCleared !== undefined ? <Text style={styles.label}>{potNeedsLine(slotsCleared)}</Text> : null
      ) : (
        <Text style={styles.label}>
          {payout.stakeUsd > 0
            ? `Pay your $${payout.stakeUsd} buy-in to play for the pot. The pot fills as players pay.`
            : "Free league: no money on this one, just bragging rights."}
        </Text>
      )}
      <Pressable
        onPress={() => setOpen((value) => !value)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
      >
        <Text style={styles.toggleText}>Details</Text>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.green} />
      </Pressable>
      {open ? (
        <View style={styles.details}>
          <Row label="Your points by Sunday, likely" value={`${me.low} to ${me.high}`} />
          <Row label="Chance you clear all 5 slots" value={formatChance(finish)} />
          {payout.eligible ? (
            <>
              <Row label="If it goes badly" value={formatNet(payout.lowNetUsd)} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Money you're on track for, this week</Text>
                <Svg width={SPARK.width} height={SPARK.height} accessible={false}>
                  <DrawLine d={spark} length={SPARK.width * 2} color={colors.green} width={2} />
                </Svg>
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN_MARGIN,
    marginTop: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: BORDER,
    borderColor: colors.divider,
  },
  money: { flexDirection: "row", gap: spacing.lg },
  cell: { flex: 1, gap: 2 },
  cellEnd: { alignItems: "flex-end" },
  label: { ...type.small, color: colors.textMuted },
  figure: { ...type.title, color: colors.text, ...tabular },
  toggle: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", minHeight: 32 },
  toggleText: { ...type.label, color: colors.green },
  details: { borderTopWidth: hairline, borderTopColor: colors.divider },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 40, borderBottomWidth: hairline, borderBottomColor: colors.divider },
  rowLabel: { ...type.small, color: colors.textMuted, flex: 1 },
  rowValue: { fontFamily: fontFamily.bold, fontSize: type.small.fontSize, color: colors.text, ...tabular },
});
