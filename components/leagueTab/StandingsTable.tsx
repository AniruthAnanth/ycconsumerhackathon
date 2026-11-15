import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { CountUp, Entrance, PressScale, ReorderRow } from "@/components/motion";
import { Avatar, Divider, formatScore, Icon } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import type { Standing } from "@/lib/backend";
import { colors, font, fontFamily, hairline, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing, type } from "@/theme";

import { rankMovement, withBaseline } from "./rankMovement";

// Fixed widths keep every number in a column lined up whatever the names are.
const COL = { rank: 24, record: 44, points: 100, streak: 44 } as const;

/** Win-loss-tie from the season table, keyed by player. */
export type SeasonRecord = { wins: number; losses: number; ties: number };

type Props = {
  rows: Standing[];
  /** The row to tint: the player this device is playing as. */
  viewerId: Id<"users"> | undefined;
  /** Season records by player; undefined while loading, shown as a dash. */
  records?: Map<string, SeasonRecord>;
  onPressPlayer: (userId: Id<"users">) => void;
};

function recordText(record: SeasonRecord | undefined): string {
  if (!record) return "–";
  return record.ties > 0 ? `${record.wins}-${record.losses}-${record.ties}` : `${record.wins}-${record.losses}`;
}

/**
 * A fantasy standings table: RK, player, W-L, PTS (this week's points, the figure that matters and
 * the largest type), STRK and the places gained or lost since the table was first shown.
 */
export function StandingsTable({ rows, viewerId, records, onPressPlayer }: Props) {
  const baseline = useRef<Record<string, number>>({});
  baseline.current = withBaseline(baseline.current, rows);

  return (
    <View>
      <View style={styles.header}>
        <Text style={[styles.heading, { width: COL.rank }]}>RK</Text>
        <Text style={[styles.heading, styles.playerCol]}>PLAYER</Text>
        <Text style={[styles.heading, styles.right, { width: COL.record }]}>W-L</Text>
        <Text style={[styles.heading, styles.right, { width: COL.points }]}>PTS</Text>
        <Text style={[styles.heading, styles.right, { width: COL.streak }]}>STRK</Text>
      </View>
      {rows.map((row, index) => {
        const moved = rankMovement(baseline.current, row);
        return (
          // Keyed by player so a rank change slides the row to its new place instead of re-drawing it.
          <ReorderRow key={row.userId}>
            <Entrance index={index}>
              <PressScale
                style={[styles.row, row.userId === viewerId && styles.viewer]}
                onPress={() => onPressPlayer(row.userId)}
                accessibilityRole="button"
                accessibilityLabel={`Rank ${row.rank}, ${row.name}${row.paid ? "" : ", unpaid"}, ${row.slotsCleared} of 5 slots, ${formatScore(row.points)} points, streak ${row.streak}`}
              >
                <View style={[styles.rankCell, { width: COL.rank }]}>
                  <Text style={styles.rank}>{row.rank}</Text>
                  {moved === 0 ? null : (
                    <Text style={[styles.move, { color: moved > 0 ? colors.accent : colors.danger }]}>
                      {`${moved > 0 ? "▲" : "▼"}${Math.abs(moved)}`}
                    </Text>
                  )}
                </View>
                <View style={styles.playerCol}>
                  <View style={styles.player}>
                    <Avatar uri={row.avatarUrl} name={row.name} size={32} />
                    <View style={styles.nameBlock}>
                      <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
                      <Text style={styles.sub}>{row.paid ? `${row.slotsCleared}/5 slots` : "Unpaid"}</Text>
                    </View>
                  </View>
                </View>
                <Text style={[styles.record, { width: COL.record }]}>{recordText(records?.get(row.userId))}</Text>
                <CountUp style={[styles.points, { width: COL.points }]} value={row.points} format={formatScore} decimals={1} />
                <View style={[styles.streak, { width: COL.streak }]}>
                  <Text style={[styles.streakText, row.streak === 0 && styles.faint]}>{row.streak}</Text>
                  <Icon name="flame" size={14} color={row.streak > 0 ? colors.text : colors.textFaint} />
                </View>
              </PressScale>
              <Divider />
            </Entrance>
          </ReorderRow>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Same look as SectionLabel, which only has room for two labels.
  header: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SCREEN_MARGIN,
    backgroundColor: colors.strip,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  heading: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted, letterSpacing: 0.6 },
  right: { textAlign: "right" },
  row: { height: ROW_HEIGHT_COMPACT, flexDirection: "row", alignItems: "center", paddingHorizontal: SCREEN_MARGIN },
  viewer: { backgroundColor: colors.accentTint },
  playerCol: { flex: 1 },
  rankCell: { alignItems: "flex-start" },
  rank: { fontSize: font.body, fontFamily: fontFamily.extraBold, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  move: { fontSize: font.meta, fontFamily: fontFamily.bold, fontVariant: ["tabular-nums"] },
  player: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  nameBlock: { flex: 1 },
  name: { fontSize: font.body, fontFamily: fontFamily.semiBold, color: colors.text },
  sub: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  record: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted, textAlign: "right", fontVariant: ["tabular-nums"] },
  points: { ...type.title, color: colors.text, textAlign: "right", fontVariant: ["tabular-nums"] },
  streak: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2 },
  streakText: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.text, fontVariant: ["tabular-nums"] },
  faint: { color: colors.textFaint },
});
