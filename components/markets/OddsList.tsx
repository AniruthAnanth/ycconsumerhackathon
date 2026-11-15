import { StyleSheet, Text, View } from "react-native";

import { ProgressFill } from "@/components/motion";
import { RowDivider, SectionLabel } from "@/components/ui";
import { colors, layout, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import { formatChance } from "./chartGeometry";
import type { Market } from "./useMarket";

/**
 * Each member's chance to top the week, sorted like a market's list of outcomes: favourite first,
 * the chance as the biggest thing in the row and a bar to compare at a glance.
 */
export function OddsList({ odds }: { odds: Market["odds"] }) {
  if (odds.length < 2) return null;
  const favourite = Math.max(...odds.map((row) => row.weekChance));
  return (
    <View testID="odds-list">
      <SectionLabel left="Odds to win the week" right="Chance" />
      {odds.map((row) => (
        <View
          key={row.userId}
          style={[styles.row, row.isMe && styles.mine]}
          accessible
          accessibilityLabel={`${row.name}${row.isMe ? " (you)" : ""}: ${formatChance(row.weekChance)} to win the week, projected ${row.projected}, ${formatChance(row.finishChance)} to clear all five slots`}
        >
          <View style={styles.who}>
            <Text style={styles.name} numberOfLines={1}>
              {row.isMe ? `${row.name} (you)` : row.name}
            </Text>
            {/* Bars scale to the favourite so a long-odds field still reads, as a market list does. */}
            <ProgressFill ratio={favourite === 0 ? 0 : row.weekChance / favourite} height={8} color={row.isMe ? colors.green : colors.muted} />
            <Text style={styles.meta}>{`Proj ${row.projected} · ${formatChance(row.finishChance)} to clear all 5`}</Text>
          </View>
          <Text style={styles.chance}>{formatChance(row.weekChance)}</Text>
          <RowDivider inset={SCREEN_MARGIN} />
        </View>
      ))}
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
