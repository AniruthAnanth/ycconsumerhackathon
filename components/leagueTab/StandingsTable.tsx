import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { CountUp, Entrance, PressScale, ReorderRow } from "@/components/motion";
import { Avatar, Divider, formatScore, Icon } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import type { Standing } from "@/lib/backend";
import { colors, font, fontFamily, hairline, layout, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import { slotsText } from "./emptyState";
import { rankMovement, withBaseline } from "./rankMovement";

// Fixed widths keep every number in a column lined up whatever the names are.
const COL = { rank: layout.avatarCompact, record: layout.numericColumn, points: layout.numericColumn, streak: layout.numericColumn } as const;
// Where the player name starts: the divider starts there too.
const NAME_INSET = SCREEN_MARGIN + COL.rank + layout.avatarCompact + spacing.sm;

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
                    <View style={[styles.avatarRing, row.userId === viewerId && styles.avatarRingViewer]}>
                      <Avatar uri={row.avatarUrl} name={row.name} size={layout.avatarCompact} />
                    </View>
                    <View style={styles.nameBlock}>
                      <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
                      <Text style={styles.sub}>{slotsText(row)}</Text>
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
              <Divider inset={NAME_INSET} />
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
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SCREEN_MARGIN,
    backgroundColor: colors.strip,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  heading: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted, letterSpacing: 0.6 },
  right: { textAlign: "right" },
  row: { minHeight: ROW_HEIGHT_COMPACT, flexDirection: "row", alignItems: "center", paddingHorizontal: SCREEN_MARGIN },
  viewer: { backgroundColor: colors.accentTint },
  playerCol: { flex: 1 },
  rankCell: { alignItems: "flex-start" },
  rank: { fontSize: font.body, fontFamily: fontFamily.extraBold, color: colors.textMuted, ...tabular },
  move: { fontSize: font.meta, fontFamily: fontFamily.bold, ...tabular },
  player: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  nameBlock: { flex: 1 },
  name: { fontSize: font.body, fontFamily: fontFamily.semiBold, color: colors.text },
  avatarRing: { width: layout.avatarCompact, height: layout.avatarCompact, borderRadius: layout.avatarCompact / 2, borderWidth: hairline, borderColor: colors.divider, overflow: "hidden" },
  avatarRingViewer: { borderColor: colors.accent },
  sub: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  record: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted, textAlign: "right", ...tabular },
  points: { ...type.label, color: colors.text, textAlign: "right", ...tabular },
  streak: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.xs },
  streakText: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.text, ...tabular },
  faint: { color: colors.textFaint },
});
