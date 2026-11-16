import { StyleSheet, Text, View } from "react-native";

import { ProgressFill, ReorderRow } from "@/components/motion";
import { Avatar, RowDivider } from "@/components/ui";
import { formatUsd } from "@/lib/leagueText";
import { BORDER, colors, layout, radius, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import { formatChance } from "./chartGeometry";
import type { Market } from "./useMarket";

/**
 * "Your share of the pot": each player's expected cut of this week's pot, which is split evenly
 * among everyone tied for the most slots cleared. The cuts add up to the pot (less the chance it
 * rolls over because no one cleared a slot). Rows slide when the order changes. A free league has no
 * money, so it shows each player's chance of being a top performer instead.
 */
export function OddsList({ odds }: { odds: Market["odds"] }) {
  // Before anyone has drafted, every row is the same coin flip over nothing.
  if (odds.rows.length < 2 || !odds.rows.some((row) => row.projected > 0)) return null;
  const pot = odds.kind === "pot";
  // Guarded because a stale backend on the shared deployment may not send shareUsd yet.
  const value = (row: Market["odds"]["rows"][number]) =>
    pot && Number.isFinite(row.shareUsd) ? formatUsd(Math.round(row.shareUsd)) : formatChance(row.chance);
  return (
    <View style={styles.card} testID="odds-list">
      <Text style={styles.title}>{pot ? "Your share of the pot" : "Who tops the week?"}</Text>
      {odds.rows.map((row, index) => (
        <ReorderRow key={row.userId}>
          <View style={styles.row} accessible accessibilityLabel={`${row.isMe ? "You" : row.name}: ${value(row)}`}>
            <Avatar name={row.name} size={32} />
            <View style={styles.who}>
              <Text style={styles.name} numberOfLines={1}>
                {row.isMe ? "You" : row.name}
              </Text>
              <ProgressFill ratio={row.chance} height={4} color={row.isMe ? colors.green : colors.faint} />
            </View>
            <Text style={styles.chance}>{value(row)}</Text>
          </View>
          {index < odds.rows.length - 1 ? <RowDivider inset={0} /> : null}
        </ReorderRow>
      ))}
      <Text style={styles.note}>
        {pot ? "Expected share. The pot splits evenly among everyone who clears the most slots." : "Chance of clearing the most slots this week."}
      </Text>
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
  title: { ...type.subheading, color: colors.text, marginBottom: spacing.xs },
  row: { minHeight: layout.rowMin + 8, flexDirection: "row", alignItems: "center", gap: spacing.md },
  who: { flex: 1, gap: spacing.xs },
  name: { ...type.label, color: colors.text },
  note: { ...type.caption, color: colors.textMuted },
  chance: { ...type.heading, ...tabular, minWidth: 64, textAlign: "right", color: colors.text },
});
