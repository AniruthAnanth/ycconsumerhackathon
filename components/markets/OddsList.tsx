import { StyleSheet, Text, View } from "react-native";

import { ProgressFill } from "@/components/motion";
import { RowDivider, SectionLabel } from "@/components/ui";
import { colors, layout, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import { formatChance } from "./chartGeometry";
import type { Market } from "./useMarket";

/**
 * Each member's chance to win the pot this week, listed like a market's outcomes: the favourite first,
 * the chance as the biggest thing in the row, and a bar for comparing at a glance. The pot goes to
 * the top scorer among players who clear all five slots, so the column adds up to 100%. When nobody
 * may clear all five, a last row shows the chance that every stake goes back. A free league has
 * no pot, so it ranks by the chance of the week's top score instead.
 */
export function OddsList({ odds }: { odds: Market["odds"] }) {
  // Before anyone has drafted, every row is the same coin flip over nothing.
  if (odds.rows.length < 2 || !odds.rows.some((row) => row.projected > 0)) return null;
  const pot = odds.kind === "pot";
  return (
    <View testID="odds-list">
      <SectionLabel left={pot ? "Chance to win the pot this week" : "Chance to top the week"} right="Chance" />
      {odds.rows.map((row) => (
        <View
          key={row.userId}
          style={[styles.row, row.isMe && styles.mine]}
          accessible
          accessibilityLabel={`${row.name}${row.isMe ? " (you)" : ""}: ${formatChance(row.chance)} to ${pot ? "win the pot" : "top the week"}, projected ${row.projected} points, ${formatChance(row.finishChance)} to clear all five slots`}
        >
          <View style={styles.who}>
            <Text style={styles.name} numberOfLines={1}>
              {row.isMe ? `${row.name} (you)` : row.name}
            </Text>
            <ProgressFill ratio={row.chance} height={8} color={row.isMe ? colors.green : colors.muted} />
            <Text style={styles.meta}>{`Proj ${row.projected} pts · ${formatChance(row.finishChance)} to clear all 5 slots`}</Text>
          </View>
          <Text style={styles.chance}>{formatChance(row.chance)}</Text>
          <RowDivider inset={SCREEN_MARGIN} />
        </View>
      ))}
      {pot && odds.nobody >= 0.005 ? (
        <View style={styles.row} accessible accessibilityLabel={`${formatChance(odds.nobody)} that nobody clears all five and every stake goes back`}>
          <View style={styles.who}>
            <Text style={styles.name}>Nobody clears all 5</Text>
            <Text style={styles.meta}>Every stake goes back</Text>
          </View>
          <Text style={styles.chance}>{formatChance(odds.nobody)}</Text>
          <RowDivider inset={SCREEN_MARGIN} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT_COMPACT,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.sm,
  },
  mine: { backgroundColor: colors.accentTint },
  who: { flex: 1, gap: spacing.xs },
  name: { ...type.label, color: colors.text },
  meta: { ...type.caption, color: colors.textMuted },
  // The same trailing numeric column as the standings below, so the two right edges line up.
  chance: { ...type.subheading, ...tabular, width: layout.numericColumn, textAlign: "right", color: colors.text },
});
