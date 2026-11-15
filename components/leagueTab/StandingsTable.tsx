import { Pressable, StyleSheet, Text, View } from "react-native";

import { CountUp, ReorderRow } from "@/components/motion";
import { Avatar, Divider, formatScore, Icon } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import type { Standing } from "@/lib/backend";
import { colors, font, hairline, ROW_HEIGHT_COMPACT, spacing } from "@/theme";

// Fixed widths keep every number in a column lined up whatever the names are.
const COL = { rank: 28, slots: 44, points: 56, streak: 48 } as const;

type Props = {
  rows: Standing[];
  /** The row to tint: the player this device is playing as. */
  viewerId: Id<"users"> | undefined;
  onPressPlayer: (userId: Id<"users">) => void;
};

/** The standings table: rank, player, slots cleared, points and streak, in the order the server ranks them. */
export function StandingsTable({ rows, viewerId, onPressPlayer }: Props) {
  return (
    <View>
      <View style={styles.header}>
        <Text style={[styles.heading, { width: COL.rank }]}>RK</Text>
        <Text style={[styles.heading, styles.playerCol]}>PLAYER</Text>
        <Text style={[styles.heading, styles.right, { width: COL.slots }]}>SLOTS</Text>
        <Text style={[styles.heading, styles.right, { width: COL.points }]}>PTS</Text>
        <Text style={[styles.heading, styles.right, { width: COL.streak }]}>STRK</Text>
      </View>
      {rows.map((row) => (
        // Keyed by player so a rank change slides the row to its new place instead of re-drawing it.
        <ReorderRow key={row.userId}>
          <Pressable
            style={[styles.row, row.userId === viewerId && styles.viewer]}
            onPress={() => onPressPlayer(row.userId)}
            accessibilityRole="button"
            accessibilityLabel={`Rank ${row.rank}, ${row.name}${row.paid ? "" : ", unpaid"}, ${row.slotsCleared} of 5 slots, ${formatScore(row.points)} points, streak ${row.streak}`}
          >
            <Text style={[styles.rank, { width: COL.rank }]}>{row.rank}</Text>
            <View style={styles.playerCol}>
              <View style={styles.player}>
                <Avatar uri={row.avatarUrl} name={row.name} size={32} />
                <View style={styles.nameBlock}>
                  <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
                  {row.paid ? null : <Text style={styles.unpaid}>Unpaid</Text>}
                </View>
              </View>
            </View>
            <Text style={[styles.slots, { width: COL.slots }]}>{`${row.slotsCleared}/5`}</Text>
            <CountUp style={[styles.points, { width: COL.points }]} value={row.points} format={formatScore} decimals={1} />
            <View style={[styles.streak, { width: COL.streak }]}>
              <Text style={styles.streakText}>{row.streak}</Text>
              <Icon name="flame" size={14} color={row.streak > 0 ? colors.text : colors.textFaint} />
            </View>
          </Pressable>
          <Divider />
        </ReorderRow>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Same look as SectionLabel, which only has room for two labels.
  header: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: colors.strip,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  heading: { fontSize: font.label, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.6 },
  right: { textAlign: "right" },
  row: { height: ROW_HEIGHT_COMPACT, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md },
  viewer: { backgroundColor: colors.accentTint },
  playerCol: { flex: 1 },
  rank: { fontSize: font.body, fontWeight: "700", color: colors.textMuted, fontVariant: ["tabular-nums"] },
  player: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  nameBlock: { flex: 1 },
  name: { fontSize: font.title, fontWeight: "600", color: colors.text },
  unpaid: { fontSize: font.meta, color: colors.textMuted },
  slots: { fontSize: font.body, color: colors.textMuted, textAlign: "right", fontVariant: ["tabular-nums"] },
  points: { fontSize: font.score, fontWeight: "700", color: colors.text, textAlign: "right", fontVariant: ["tabular-nums"] },
  streak: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2 },
  streakText: { fontSize: font.body, color: colors.text, fontVariant: ["tabular-nums"] },
});
