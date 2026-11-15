import { StyleSheet, Text, View } from "react-native";

import { ProgressFill } from "@/components/motion";
import { RowDivider, SectionLabel } from "@/components/ui";
import { colors, layout, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import { formatChance } from "./chartGeometry";
import type { Market } from "./useMarket";

/**
 * Each member's chance to win the pot this week, sorted like a market's list of outcomes: favourite
 * first, the chance as the biggest thing in the row and a bar to compare at a glance. Winning the
 * pot means clearing all five slots, since only finishers keep their stake and split the rest;
 * the chance of the week's top score sits underneath.
 */
export function OddsList({ odds }: { odds: Market["odds"] }) {
  if (odds.length < 2) return null;
  const rows = [...odds].sort((a, b) => b.finishChance - a.finishChance || b.projected - a.projected || a.name.localeCompare(b.name));
  return (
    <View testID="odds-list">
      <SectionLabel left="Chance to win the pot this week" right="Chance" />
      {rows.map((row) => (
        <View
          key={row.userId}
          style={[styles.row, row.isMe && styles.mine]}
          accessible
          accessibilityLabel={`${row.name}${row.isMe ? " (you)" : ""}: ${formatChance(row.finishChance)} to win the pot, projected ${row.projected} points, ${formatChance(row.weekChance)} to top the week`}
        >
          <View style={styles.who}>
            <Text style={styles.name} numberOfLines={1}>
              {row.isMe ? `${row.name} (you)` : row.name}
            </Text>
            <ProgressFill ratio={row.finishChance} height={8} color={row.isMe ? colors.green : colors.muted} />
            <Text style={styles.meta}>{`Proj ${row.projected} pts · ${formatChance(row.weekChance)} to top the week`}</Text>
          </View>
          <Text style={styles.chance}>{formatChance(row.finishChance)}</Text>
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
