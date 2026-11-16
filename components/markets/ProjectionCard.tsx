import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg from "react-native-svg";

import { cardStyle, Icon } from "@/components/ui";
import { colors, fontFamily, hairline, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import { formatChance, sparkPath } from "./chartGeometry";
import { formatUsd } from "@/lib/leagueText";
import { DrawLine } from "./DrawLine";
import type { Market } from "./useMarket";

/** "Dec 6", in the league's Pacific time. */
const cashOutDate = (at: number) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });

const SPARK = { width: 96, height: 36, padding: 3 };

/**
 * Money first, the way a market quotes a payout: your expected share of this week's pot, which
 * stays in league escrow until cash out, beside what everyone gets if everyone clears all five.
 * The chances and the trend sit behind Details, so a first-time player reads one line.
 */
export function ProjectionCard({ market }: { market: Market }) {
  const [open, setOpen] = useState(false);
  const { payout, me } = market;
  const finish = market.odds.rows.find((row) => row.isMe)?.finishChance ?? 0;
  const spark = sparkPath(payout.history.map(({ at, netUsd }) => ({ at, value: netUsd })), SPARK);
  // Guarded because a stale backend on the shared deployment may not send the new fields yet.
  const share = Number.isFinite(payout.expectedShareUsd) ? payout.expectedShareUsd : payout.expectedNetUsd + payout.stakeUsd;
  const everyone = Number.isFinite(payout.everyoneShareUsd) ? payout.everyoneShareUsd : payout.stakeUsd;

  return (
    <View style={styles.card} testID="projection-card">
      {payout.eligible ? (
        <View style={styles.money} accessible accessibilityLabel={`Your expected share: ${formatUsd(Math.round(share))}, in escrow. If everyone clears all 5: ${formatUsd(Math.round(everyone))} each`}>
          <View style={styles.cell}>
            <Text style={styles.label}>Your expected share</Text>
            <Text style={[styles.figure, { color: share < payout.stakeUsd ? colors.textMuted : colors.green }]}>{formatUsd(Math.round(share))}</Text>
          </View>
          <View style={[styles.cell, styles.cellEnd]}>
            <Text style={styles.label}>If everyone clears all 5</Text>
            <Text style={styles.figure}>{`${formatUsd(Math.round(everyone))} each`}</Text>
          </View>
        </View>
      ) : null}
      <Text style={styles.label}>
        {payout.eligible
          ? `In escrow. Cash out ${Number.isFinite(payout.cashOutAt) ? cashOutDate(payout.cashOutAt) : "at season end"}.`
          : payout.stakeUsd > 0
            ? `Pay your $${payout.stakeUsd} buy-in to play for the pot. The pot fills as players pay.`
            : "Free league: no money on this one, just bragging rights."}
      </Text>
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
              <Row label="Chance you share the pot" value={formatChance(payout.potChance)} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Your expected share less buy-in, this week</Text>
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
    ...cardStyle,
    marginHorizontal: SCREEN_MARGIN,
    marginTop: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
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
