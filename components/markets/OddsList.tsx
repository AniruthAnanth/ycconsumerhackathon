import { StyleSheet, Text, View } from "react-native";

import { ProgressFill, ReorderRow } from "@/components/motion";
import { Avatar, RowDivider } from "@/components/ui";
import { BORDER, colors, layout, radius, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import { formatChance } from "./chartGeometry";
import type { Market } from "./useMarket";

/**
 * "Who wins the pot", laid out as one multi-outcome market: the pot at the top, then one row per
 * player with their chance as the biggest figure and a thin bar, favourite first. The pot goes to
 * the top scorer among players who clear all five slots, so the column adds up to 100% (with a
 * last row for nobody clearing, when that can happen). Rows slide when the order changes. A free
 * league has no pot, so it asks who tops the week instead.
 */
export function OddsList({ odds }: { odds: Market["odds"] }) {
  // Before anyone has drafted, every row is the same coin flip over nothing.
  if (odds.rows.length < 2 || !odds.rows.some((row) => row.projected > 0)) return null;
  const pot = odds.kind === "pot";
  return (
    <View style={styles.card} testID="odds-list">
      <View style={styles.head}>
        <Text style={styles.title}>{pot ? "Who wins the pot?" : "Who tops the week?"}</Text>
      </View>
      {odds.rows.map((row, index) => (
        <ReorderRow key={row.userId}>
          <View style={styles.row} accessible accessibilityLabel={`${row.name}${row.isMe ? " (you)" : ""}: ${formatChance(row.chance)}`}>
            <Avatar name={row.name} size={32} />
            <View style={styles.who}>
              <Text style={styles.name} numberOfLines={1}>
                {row.isMe ? "You" : row.name}
              </Text>
              <ProgressFill ratio={row.chance} height={4} color={row.isMe ? colors.green : colors.faint} />
            </View>
            <Text style={styles.chance}>{formatChance(row.chance)}</Text>
          </View>
          {index < odds.rows.length - 1 || (pot && odds.nobody >= 0.005) ? <RowDivider inset={0} /> : null}
        </ReorderRow>
      ))}
      {pot && odds.nobody >= 0.005 ? (
        <View style={styles.row} accessible accessibilityLabel={`${formatChance(odds.nobody)} that nobody clears all five and every stake goes back`}>
          <View style={styles.who}>
            <Text style={styles.name}>Nobody clears all 5</Text>
            <Text style={styles.note}>Every stake goes back</Text>
          </View>
          <Text style={styles.chance}>{formatChance(odds.nobody)}</Text>
        </View>
      ) : null}
      <Text style={styles.note}>{pot ? "The pot goes to the top scorer who clears all 5 slots." : "Chance of the week's highest score."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN_MARGIN,
    marginVertical: spacing.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: BORDER,
    borderColor: colors.divider,
  },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: spacing.xs },
  title: { ...type.subheading, color: colors.text },
  row: { minHeight: layout.rowMin + 8, flexDirection: "row", alignItems: "center", gap: spacing.md },
  who: { flex: 1, gap: spacing.xs },
  name: { ...type.label, color: colors.text },
  note: { ...type.caption, color: colors.textMuted },
  chance: { ...type.heading, ...tabular, minWidth: 64, textAlign: "right", color: colors.text },
});
