import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SLOT_NAME } from "@/lib/slots";
import { taskPlaceLine, taskRowLabel, taskStatusLine, type TaskRowData } from "@/lib/taskText";
import { colors, font, hairline, ROW_HEIGHT, spacing } from "@/theme";

import { Avatar } from "./Avatar";
import { PositionPill } from "./PositionPill";
import { Score } from "./Score";

type Props = {
  task: TaskRowData;
  /** The Up Next task: tinted, with an UP NEXT tag in place of the slot name. */
  highlighted?: boolean;
  onPress?: () => void;
  /** Replaces the score column, for example with Submit Proof on the Up Next row. */
  right?: ReactNode;
};

/**
 * One task as an ESPN player row: position pill, thumbnail, three lines of
 * text and the score. Roster and the task sheet both draw tasks with it.
 */
export function TaskRow({ task, highlighted = false, onPress, right }: Props) {
  const place = taskPlaceLine(task);
  const label = taskRowLabel(task, highlighted);
  const lead = (
    <>
      <PositionPill slot={task.slot} />
      <Avatar uri={task.thumbUrl} slot={task.slot} />
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={styles.title} numberOfLines={1}>
            {task.title}
          </Text>
          <Text style={[styles.tag, highlighted && styles.tagUpNext]}>{highlighted ? "UP NEXT" : SLOT_NAME[task.slot]}</Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {taskStatusLine(task)}
        </Text>
        {place ? (
          <Text style={styles.meta} numberOfLines={1}>
            {place}
          </Text>
        ) : null}
      </View>
    </>
  );
  const row = (
    <View style={[styles.row, highlighted && styles.highlighted]}>
      {/* A control in `right` sits beside the row's button, not inside it: a screen reader cannot reach a button nested in another. */}
      {onPress && right ? (
        <Pressable style={styles.lead} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
          {lead}
        </Pressable>
      ) : (
        lead
      )}
      {right ?? <Score value={task.score} projected={task.points} />}
    </View>
  );
  if (!onPress || right) return row;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {row}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  highlighted: { backgroundColor: colors.accentTint },
  // The same columns as the row itself, stretched to its full height so the whole left side takes the tap.
  lead: { flex: 1, alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1, gap: 1 },
  titleLine: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  title: { flexShrink: 1, fontSize: font.title, fontWeight: "700", color: colors.text },
  tag: { fontSize: font.label, color: colors.textMuted },
  tagUpNext: { color: colors.accent, fontWeight: "700", letterSpacing: 0.3 },
  meta: { fontSize: font.meta, color: colors.textMuted },
});
