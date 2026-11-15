import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui";
import { colors, font, spacing } from "@/theme";

import { movementMark, rowSubtitle } from "./format";
import type { BoardRow } from "./types";

/** Rank, movement and avatar share this width so the names line up down the table. */
export const RANK_WIDTH = 24;
export const MOVEMENT_WIDTH = 30;

const MOVEMENT_COLOR = { up: colors.tabActive, down: colors.danger, flat: colors.textFaint } as const;

type Props = {
  row: BoardRow;
  onPress: () => void;
};

/** One standings line, about 60 px: rank, movement, avatar, name over context, and the score on the right. */
export function LeaderboardRow({ row, onPress }: Props) {
  const movement = movementMark(row.movement);
  const subtitle = rowSubtitle(row);
  return (
    <Pressable
      style={[styles.row, row.isMe && styles.me]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.rank}. ${row.name}, ${row.valueLabel}`}
    >
      <Text style={styles.rank}>{row.rank}</Text>
      <Text style={[styles.movement, { color: MOVEMENT_COLOR[movement.tone] }]}>{movement.text}</Text>
      <Avatar uri={row.avatarUrl} name={row.name} size={36} />
      <View style={styles.who}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {row.name}
          </Text>
          {row.isMe ? <Tag label="YOU" color={colors.accent} /> : null}
          {row.isRival ? <Tag label="RIVAL" color={colors.danger} /> : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={styles.value}>{row.valueLabel}</Text>
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
  row: { height: 60, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
  // The caller finds themselves at a glance.
  me: { backgroundColor: colors.accentTint },
  rank: { width: RANK_WIDTH, fontSize: font.score, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  movement: { width: MOVEMENT_WIDTH, fontSize: font.label, fontWeight: "700" },
  who: { flex: 1, gap: 2 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { flexShrink: 1, fontSize: font.title, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: font.meta, color: colors.textMuted },
  value: { fontSize: font.score, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"], textAlign: "right" },
  tag: { borderWidth: 1, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  tagText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
});
