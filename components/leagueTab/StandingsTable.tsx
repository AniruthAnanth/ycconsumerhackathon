import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LiveRow } from "@/components/live/LiveRow";
import { rankChanges, ranksOf } from "@/components/live/rankChanges";
import { CountUp, Entrance, PressScale } from "@/components/motion";
import { Avatar, Divider, formatScore, Icon } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import type { Standing } from "@/lib/backend";
import { haptics } from "@/lib/native/haptics";
import { colors, font, fontFamily, hairline, layout, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import { slotsText } from "./emptyState";
import { rankMovement, withBaseline } from "./rankMovement";
import type { SeasonRecord } from "./seasonColumns";

// Fixed widths keep every number in a column lined up whatever the names are. Four numbers at
// numericColumn leave a name under 60 pt at 390 pt, so each gives up a column gap to keep ~100 pt.
const NUMBER = layout.numericColumn - layout.columnGap;
const COL = { rank: layout.avatarCompact, record: NUMBER, pointsFor: NUMBER, pointsAgainst: NUMBER, streak: NUMBER } as const;
// Where the player name starts: the divider starts there too.
const NAME_INSET = SCREEN_MARGIN + COL.rank + layout.avatarCompact + layout.columnGap;

type Props = {
  rows: Standing[];
  /** The row to tint: the player this device is playing as. */
  viewerId: Id<"users"> | undefined;
  /** Season records by player; a player missing from it shows dashes. */
  records?: Map<string, SeasonRecord>;
  /** How many make the playoffs; the playoff line is drawn under that rank. Null without playoffs. */
  playoffSpots?: number | null;
  onPressPlayer: (userId: Id<"users">) => void;
};

function recordText(record: SeasonRecord | undefined): string {
  if (!record) return "–";
  return record.ties > 0 ? `${record.wins}-${record.losses}-${record.ties}` : `${record.wins}-${record.losses}`;
}

/**
 * A fantasy standings table in season order: RK, player, W-L, PF (season points for, the largest
 * type), PA (points against), STRK, the places gained or lost since the table was first shown,
 * and the playoff line when the format has one.
 */
export function StandingsTable({ rows, viewerId, records, playoffSpots = null, onPressPlayer }: Props) {
  const baseline = useRef<Record<string, number>>({});
  baseline.current = withBaseline(baseline.current, rows);
  // Each rows result is compared once, so a re-render with the same data never re-flashes a row.
  const live = useRef<{ rows?: Standing[]; ranks?: Record<string, number>; flash: Record<string, number>; moved: number }>({ flash: {}, moved: 0 });
  if (live.current.rows !== rows) {
    const moved = rankChanges(live.current.ranks, rows);
    for (const userId of moved) live.current.flash[userId] = (live.current.flash[userId] ?? 0) + 1;
    live.current = { rows, ranks: ranksOf(rows), flash: live.current.flash, moved: moved.size };
  }
  useEffect(() => {
    if (live.current.moved > 0) haptics.tap();
  }, [rows]);

  return (
    <View>
      <View style={styles.header}>
        <Text style={[styles.heading, { width: COL.rank }]}>RK</Text>
        <Text style={[styles.heading, styles.playerCol, styles.playerHeading]}>PLAYER</Text>
        <Text style={[styles.heading, styles.right, { width: COL.record }]}>W-L</Text>
        <Text style={[styles.heading, styles.right, { width: COL.pointsFor }]}>PF</Text>
        <Text style={[styles.heading, styles.right, { width: COL.pointsAgainst }]}>PA</Text>
        <Text style={[styles.heading, styles.right, { width: COL.streak }]}>STRK</Text>
      </View>
      {rows.map((row, index) => {
        const moved = rankMovement(baseline.current, row);
        const record = records?.get(row.userId);
        const cutline = playoffSpots !== null && row.rank === playoffSpots && index < rows.length - 1;
        return (
          // Keyed by player so a rank change slides the row to its new place instead of re-drawing it.
          <LiveRow key={row.userId} flash={live.current.flash[row.userId] ?? 0}>
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
                <Text style={[styles.record, { width: COL.record }]}>{recordText(record)}</Text>
                {record ? (
                  <CountUp style={[styles.points, { width: COL.pointsFor }]} value={record.pointsFor} format={formatScore} decimals={1} />
                ) : (
                  <Text style={[styles.points, { width: COL.pointsFor }]}>–</Text>
                )}
                <Text style={[styles.record, { width: COL.pointsAgainst }]}>{record ? formatScore(record.pointsAgainst) : "–"}</Text>
                <View style={[styles.streak, { width: COL.streak }]}>
                  <Icon name="flame" size={14} color={row.streak > 0 ? colors.text : colors.textFaint} />
                  <Text style={[styles.streakText, row.streak === 0 && styles.faint]}>{row.streak}</Text>
                </View>
              </PressScale>
              {cutline ? (
                <View accessibilityLabel={`Playoff line, top ${playoffSpots} make the playoffs`}>
                  <Divider />
                  <Text style={[styles.heading, styles.cutlineLabel]}>PLAYOFF LINE</Text>
                  <Divider />
                </View>
              ) : (
                <Divider inset={NAME_INSET} />
              )}
            </Entrance>
          </LiveRow>
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
  // PLAYER sits over the names, past the avatar column, not over the avatars.
  playerHeading: { paddingLeft: layout.avatarCompact + layout.columnGap },
  rankCell: { alignItems: "flex-start" },
  rank: { fontSize: font.body, fontFamily: fontFamily.extraBold, color: colors.textMuted, ...tabular },
  move: { fontSize: font.meta, fontFamily: fontFamily.bold, ...tabular },
  player: { flexDirection: "row", alignItems: "center", gap: layout.columnGap },
  nameBlock: { flex: 1 },
  name: { fontSize: font.body, fontFamily: fontFamily.semiBold, color: colors.text },
  avatarRing: { width: layout.avatarCompact, height: layout.avatarCompact, borderRadius: layout.avatarCompact / 2, borderWidth: hairline, borderColor: colors.divider, overflow: "hidden" },
  avatarRingViewer: { borderColor: colors.accent },
  sub: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  record: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted, textAlign: "right", ...tabular },
  points: { ...type.label, color: colors.text, textAlign: "right", ...tabular },
  // The figure ends at the margin under the right-aligned STRK heading; the flame leads it.
  streak: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.xs },
  streakText: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.text, ...tabular },
  faint: { color: colors.textFaint },
  // Muted like the column headings, starting where the names do.
  cutlineLabel: { paddingLeft: NAME_INSET, paddingVertical: spacing.xs },
});
