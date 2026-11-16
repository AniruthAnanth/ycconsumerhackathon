import { useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { PositionPill, RowDivider, Score, taskPlaceLine, taskStatusLine } from "@/components/ui";
import { colors, font, fontFamily, layout, MIN_TARGET, ROW_HEIGHT, SCREEN_MARGIN, spacing, TASK_TEXT_INSET, type } from "@/theme";

import { canRemoveTask } from "./lineupEdit";
import type { DraftTask } from "../backend";

type Props = {
  task: DraftTask;
  editable: boolean;
  suggested: boolean;
  onRename: (title: string) => void;
  onRemove: () => void;
  onTitleDone?: (title: string) => void;
};

/** Laid out like the shared TaskRow, whose title is static text: here the title edits in place and points are read-only. */
export function DraftRow({ task, editable, suggested, onRename, onRemove, onTitleDone }: Props) {
  // Remembered on focus, so leaving the field re-rates only a title that actually changed.
  const titleOnFocus = useRef(task.title);
  const place = taskPlaceLine(task);
  // Nearly every task is a plain photo, so the proof type is worth a line only when it asks for more.
  // The flex row is the one optional bonus, which the line says before anything else.
  const meta = [task.slot === "flex" ? "Bonus · optional" : null, task.proofType === "photo" ? null : taskStatusLine(task)]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={styles.row} testID={`draft-row-${task.slot}`}>
      <PositionPill slot={task.slot} />
      <View style={styles.text}>
        <TextInput
          style={styles.title}
          value={task.title}
          onChangeText={onRename}
          editable={editable}
          // A suggestion is there to be replaced, so the first tap selects all of it.
          selectTextOnFocus={suggested}
          testID={`draft-title-${task.slot}`}
          placeholder="Task"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="Task title"
          multiline
          // The web draws a multiline field as a two-row textarea, which left a blank line under a short title.
          numberOfLines={Platform.OS === "web" ? 1 : undefined}
          scrollEnabled={false}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          onFocus={() => {
            titleOnFocus.current = task.title;
          }}
          onEndEditing={() => {
            if (task.title.trim() !== titleOnFocus.current.trim() && task.title.trim() !== "") onTitleDone?.(task.title);
          }}
        />
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {place ? (
          <Text style={styles.meta} numberOfLines={1}>
            {place}
          </Text>
        ) : null}
      </View>
      {/* Its own column, centred on the row like the points, rather than stacked under them. */}
      {editable && canRemoveTask(task) ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${task.title}`} onPress={onRemove} style={styles.removeTarget}>
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      ) : null}
      <View style={styles.trailing}>
        <Score value={task.points} />
      </View>
      <RowDivider inset={TASK_TEXT_INSET} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  text: { flex: 1 },
  // No minHeight: a one-line title is exactly its line height, so the row's centring lines it up with the pill and points.
  title: { ...type.subheading, color: colors.text, padding: 0, textAlignVertical: "center" },
  meta: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  trailing: { width: layout.numericColumn, flexShrink: 0, alignItems: "flex-end", justifyContent: "center", gap: spacing.xs },
  removeTarget: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, alignItems: "flex-end", justifyContent: "center" },
  remove: { fontFamily: fontFamily.semiBold, fontSize: font.meta, color: colors.textMuted },
});
