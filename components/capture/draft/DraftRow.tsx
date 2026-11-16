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
};

/** Laid out like the shared TaskRow, whose title is static text: here the title edits in place and points are read-only. */
export function DraftRow({ task, editable, suggested, onRename, onRemove }: Props) {
  const place = taskPlaceLine(task);
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
        />
        {/* Nearly every task is a plain photo, so the proof type is worth a line only when it asks for more. */}
        {task.proofType === "photo" ? null : (
          <Text style={styles.meta} numberOfLines={1}>
            {taskStatusLine(task)}
          </Text>
        )}
        {place ? (
          <Text style={styles.meta} numberOfLines={1}>
            {place}
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        <Score value={task.points} />
        {editable && canRemoveTask(task) ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${task.title}`} onPress={onRemove} style={styles.removeTarget}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        ) : null}
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
  title: { ...type.subheading, minHeight: 28, color: colors.text, padding: 0, textAlignVertical: "top" },
  meta: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  trailing: { width: layout.numericColumn, flexShrink: 0, alignItems: "flex-end", justifyContent: "center", gap: spacing.xs },
  removeTarget: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, alignItems: "flex-end", justifyContent: "center" },
  remove: { fontFamily: fontFamily.semiBold, fontSize: font.meta, color: colors.textMuted },
});
