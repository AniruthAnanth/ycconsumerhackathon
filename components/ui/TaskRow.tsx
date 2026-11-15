import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressScale } from "@/components/motion";

import { SLOT_NAME } from "@/lib/slots";
import { taskPlaceLine, taskRowLabel, taskStatusLine, type TaskRowData } from "@/lib/taskText";
import { colors, font, fontFamily, layout, ROW_HEIGHT, SCREEN_MARGIN, spacing, TASK_TEXT_INSET } from "@/theme";

import { Avatar } from "./Avatar";
import { PositionPill } from "./PositionPill";
import { RowDivider } from "./Divider";
import { Score } from "./Score";

type Props = {
  task: TaskRowData;
  /** The Up Next task: tinted, with an UP NEXT tag in place of the slot name. */
  highlighted?: boolean;
  onPress?: () => void;
  /** Replaces the score column, for example with Submit Proof on the Up Next row. */
  right?: ReactNode;
  /** Lines the title may use; defaults to 2 when highlighted, else 1. */
  titleLines?: number;
};

/**
 * One task as an ESPN player row: position pill, thumbnail, three lines of
 * text and the score. Roster and the task sheet both draw tasks with it.
 */
export function TaskRow({ task, highlighted = false, onPress, right, titleLines }: Props) {
  const place = taskPlaceLine(task);
  const label = taskRowLabel(task, highlighted);
  const lead = (
    <>
      <PositionPill slot={task.slot} />
      <Avatar uri={task.thumbUrl} slot={task.slot} />
      <View style={styles.text}>
        {/* Up Next shares its row with a button, so its tag sits above the title and the title may wrap: beside the title, the two left a narrow phone one letter of it. */}
        {highlighted ? <Text style={[styles.tag, styles.tagUpNext]}>UP NEXT</Text> : null}
        <View style={styles.titleLine}>
          <Text style={styles.title} numberOfLines={titleLines ?? 2}>
            {task.title}
          </Text>
          {highlighted ? null : <Text style={styles.tag}>{SLOT_NAME[task.slot]}</Text>}
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
        <PressScale style={styles.lead} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
          {lead}
        </PressScale>
      ) : (
        lead
      )}
      {right ?? <Score value={task.score} projected={task.points} animated />}
      <RowDivider inset={TASK_TEXT_INSET} />
    </View>
  );
  if (!onPress || right) return row;
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {row}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
    // Room above and below for the Up Next row, the one that can grow past the minimum.
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  highlighted: { backgroundColor: colors.accentTint },
  // The same columns as the row itself, stretched to its full height so the whole left side takes the tap.
  lead: { flex: 1, alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: layout.columnGap },
  text: { flex: 1, gap: 1 },
  titleLine: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  title: { flexShrink: 1, fontSize: font.title, fontFamily: fontFamily.bold, color: colors.text },
  // Never shrinks: on the web a squeezed tag wraps onto a second line.
  tag: { flexShrink: 0, fontFamily: fontFamily.regular, fontSize: font.label, color: colors.textMuted },
  tagUpNext: { color: colors.accent, fontFamily: fontFamily.bold, letterSpacing: 0.3 },
  meta: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
});
