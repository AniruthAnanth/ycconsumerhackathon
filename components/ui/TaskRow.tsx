import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PressHighlight, PressRow } from "@/components/motion";
import { haptics } from "@/lib/native/haptics";

import { formatScore, taskPlaceLine, taskRowLabel, taskRowLine, type TaskRowData } from "@/lib/taskText";
import { colors, font, fontFamily, layout, ROW_HEIGHT, SCREEN_MARGIN, spacing, TASK_TEXT_INSET, tabular } from "@/theme";

import { PositionPill } from "./PositionPill";
import { RowDivider } from "./Divider";
import { Score } from "./Score";

type Props = {
  task: TaskRowData;
  /** The Up Next task: tinted, with an UP NEXT tag in place of the slot name. */
  highlighted?: boolean;
  onPress?: () => void;
  /** Replaces the score column, for example with Submit Proof on the Up Next row; it shares the row's one background. */
  right?: ReactNode;
  /** Lines the title may use; defaults to 2 when highlighted, else 1. */
  titleLines?: number;
};

/**
 * One task as an ESPN player row: position pill, thumbnail, three lines of
 * text and the score. Roster and the task sheet both draw tasks with it.
 */
export function TaskRow({ task, highlighted = false, onPress, right, titleLines }: Props) {
  const [pressed, setPressed] = useState(false);
  const place = taskPlaceLine(task);
  const label = taskRowLabel(task, highlighted);
  const lead = (
    <>
      {/* The pill is the row's one slot cue: no slot icon and no slot name in the line under the title. */}
      <PositionPill slot={task.slot} />
      <View style={styles.text}>
        {/* Up Next shares its row with a button, so its tag sits above the title and the title may wrap: beside the title, the two left a narrow phone one letter of it. */}
        {highlighted ? <Text style={[styles.tag, styles.tagUpNext]}>UP NEXT</Text> : null}
        <Text style={styles.title} numberOfLines={titleLines ?? 2}>
          {task.title}
        </Text>
        {/* No empty meta line: it pushed a one-line title above the row's centre. */}
        {taskRowLine(task) ? (
          <Text style={styles.meta} numberOfLines={2}>
            {taskRowLine(task)}
          </Text>
        ) : null}
        {place ? (
          <Text style={styles.meta} numberOfLines={2}>
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
        // The whole row darkens while its left side is held, so row and button read as one unit.
        <Pressable
          style={styles.lead}
          onPress={() => {
            haptics.press("light");
            onPress();
          }}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {lead}
        </Pressable>
      ) : (
        lead
      )}
      {right ??
        (task.score == null ? (
          // Unscored: the points on offer, once, in one muted line.
          <Text style={styles.offer}>{`${formatScore(task.points)} pts`}</Text>
        ) : (
          <Score value={task.score} animated />
        ))}
      <RowDivider inset={TASK_TEXT_INSET} />
      <PressHighlight visible={pressed} />
    </View>
  );
  if (!onPress || right) return row;
  return (
    <PressRow onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {row}
    </PressRow>
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
  title: { fontSize: font.title, fontFamily: fontFamily.bold, color: colors.text },
  // Never shrinks: on the web a squeezed tag wraps onto a second line.
  tag: { flexShrink: 0, fontFamily: fontFamily.regular, fontSize: font.label, color: colors.textMuted },
  tagUpNext: { color: colors.accent, fontFamily: fontFamily.bold, letterSpacing: 0.3 },
  meta: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  offer: { minWidth: layout.numericColumn, textAlign: "right", fontFamily: fontFamily.semiBold, fontSize: font.meta, color: colors.textMuted, ...tabular },
});
