import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui";
import { colors, font, fontFamily, hairline, layout, radius, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing, tabular } from "@/theme";

import { movementMark, rowSubtitle } from "./format";
import type { BoardRow } from "./types";

/** Rank, movement and avatar share this width so the names line up down the table. */
export const RANK_WIDTH = 30;
export const MOVEMENT_WIDTH = 30;
/** The trailing score column, shared with the table header so PTS sits over the figures. */
export const VALUE_WIDTH = layout.numericColumn + spacing.lg;
/** Where the name starts; dividers start here, as in an iOS list. The movement column only counts while it shows. */
export function rowTextInset(showMovement: boolean): number {
  return SCREEN_MARGIN + RANK_WIDTH + layout.avatarCompact + 2 * layout.columnGap + (showMovement ? MOVEMENT_WIDTH + layout.columnGap : 0);
}

const MOVEMENT_COLOR = { up: colors.tabActive, down: colors.danger, flat: colors.textFaint } as const;

type Props = {
  row: BoardRow;
  /** Another row holds the same rank. */
  tied: boolean;
  /** Some row on the board has moved; until then the column is empty dashes and is left out. */
  showMovement: boolean;
  onPress: () => void;
};

/** One standings line, at least 60 px: rank, movement, avatar, name over context, and the score on the right. */
export function LeaderboardRow({ row, tied, showMovement, onPress }: Props) {
  const movement = movementMark(row.movement);
  const subtitle = rowSubtitle(row);
  return (
    <Pressable
      style={[styles.row, row.isMe && styles.me]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.rank}. ${row.name}${row.isMe ? ", you" : ""}, ${row.valueLabel}`}
    >
      <Text style={styles.rank}>{tied ? `T${row.rank}` : row.rank}</Text>
      {showMovement ? <Text style={[styles.movement, { color: MOVEMENT_COLOR[movement.tone] }]}>{movement.text}</Text> : null}
      {/* The same ringed avatar as the League standings, so a player looks the same on both. */}
      <View style={[styles.avatarRing, row.isMe && styles.avatarRingMe]}>
        <Avatar uri={row.avatarUrl} name={row.name} size={layout.avatarCompact} />
      </View>
      <View style={styles.who}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {row.name}
          </Text>
          {row.isRival ? <Tag label="RIVAL" color={colors.danger} /> : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{row.valueLabel}</Text>
    </Pressable>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: ROW_HEIGHT_COMPACT, paddingVertical: spacing.xs, flexDirection: "row", alignItems: "center", gap: layout.columnGap, paddingHorizontal: SCREEN_MARGIN },
  // The tint is how the caller finds themselves; a YOU pill on top of it said the same thing twice and cost the name its room.
  me: { backgroundColor: colors.accentTint },
  rank: { width: RANK_WIDTH, fontSize: font.score, fontFamily: fontFamily.extraBold, color: colors.text, ...tabular },
  movement: { width: MOVEMENT_WIDTH, fontSize: font.label, fontFamily: fontFamily.bold },
  avatarRing: { width: layout.avatarCompact, height: layout.avatarCompact, borderRadius: layout.avatarCompact / 2, borderWidth: hairline, borderColor: colors.divider, overflow: "hidden" },
  avatarRingMe: { borderColor: colors.accent },
  who: { flex: 1, gap: spacing.xs },
  nameLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { flexShrink: 1, fontSize: font.title, fontFamily: fontFamily.bold, color: colors.text },
  subtitle: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  value: { fontSize: font.score, fontFamily: fontFamily.extraBold, color: colors.text, ...tabular, textAlign: "right", width: VALUE_WIDTH },
  tag: { borderWidth: hairline, borderRadius: radius.sm, paddingHorizontal: spacing.xs },
  tagText: { fontSize: font.label, fontFamily: fontFamily.extraBold, letterSpacing: 0.5 },
});
