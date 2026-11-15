import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, Divider, Score } from "@/components/ui";
import { colors, font, fontFamily, hairline, layout, SCREEN_MARGIN, spacing, tabular } from "@/theme";

import type { SeasonTableRow } from "./types";

type Props = {
  rows: SeasonTableRow[];
  meId: string;
  onPlayerPress?: (userId: string) => void;
};

const RANK_WIDTH = spacing.xl;
const RECORD_WIDTH = layout.numericColumn;
const AVATAR_SIZE = layout.avatarCompact;
const NAME_INSET = SCREEN_MARGIN + RANK_WIDTH + AVATAR_SIZE + spacing.sm;
// Fixed, because the shared Score box grows with its figure: a 6-character
// total in one row would push that row's record left of the other rows'.
const POINTS_WIDTH = 72;

/** The season standings: rank, player, record and points for, one dense row each. */
export function SeasonTable({ rows, meId, onPlayerPress }: Props) {
  return (
    <View>
      <View style={styles.header}>
        <Text style={[styles.headerLabel, styles.rank]}>RK</Text>
        <Text style={[styles.headerLabel, styles.player]}>PLAYER</Text>
        <Text style={[styles.headerLabel, styles.record]}>W-L</Text>
        <Text style={[styles.headerLabel, styles.pointsHeader]}>PF</Text>
      </View>
      {rows.map((row) => (
        <View key={row.userId}>
          <TableRow row={row} isMe={row.userId === meId} onPress={onPlayerPress} />
          <Divider inset={NAME_INSET} />
        </View>
      ))}
    </View>
  );
}

function recordText({ wins, losses, ties }: SeasonTableRow): string {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

function TableRow({ row, isMe, onPress }: { row: SeasonTableRow; isMe: boolean; onPress?: (userId: string) => void }) {
  const content = (
    <View style={styles.row}>
      <Text style={[styles.rankValue, styles.rank]}>{row.rank}</Text>
      <View style={[styles.player, styles.playerCell]}>
        <Avatar uri={row.avatarUrl} name={row.name} size={AVATAR_SIZE} />
        <Text style={[styles.name, isMe && styles.me]} numberOfLines={1}>
          {row.name}
        </Text>
      </View>
      <Text style={[styles.recordValue, styles.record]}>{recordText(row)}</Text>
      <View style={styles.points}>
        <Score value={row.pointsFor} />
      </View>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={() => onPress(row.userId)} accessibilityRole="button" accessibilityLabel={row.name}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SCREEN_MARGIN,
    backgroundColor: colors.strip,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  headerLabel: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted, letterSpacing: 0.6 },
  row: {
    minHeight: layout.rowMin + spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SCREEN_MARGIN,
  },
  rank: { width: RANK_WIDTH },
  player: { flex: 1 },
  playerCell: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  points: { width: POINTS_WIDTH, alignItems: "flex-end" },
  pointsHeader: { width: POINTS_WIDTH, textAlign: "right" },
  record: { width: RECORD_WIDTH, textAlign: "right", marginRight: layout.columnGap },
  rankValue: { fontSize: font.body, fontFamily: fontFamily.extraBold, color: colors.textMuted, ...tabular },
  name: { flex: 1, fontSize: font.title, fontFamily: fontFamily.semiBold, color: colors.text },
  me: { color: colors.accent },
  recordValue: { fontFamily: fontFamily.regular, fontSize: font.body, color: colors.text, ...tabular },
});
