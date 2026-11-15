import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Avatar, PositionPill, Score, taskPlaceLine, taskStatusLine } from "@/components/ui";
import { colors, font, fontFamily, hairline, MIN_TARGET, ROW_HEIGHT, SCREEN_MARGIN, spacing, type } from "@/theme";

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
      <Avatar slot={task.slot} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  text: { flex: 1, gap: 1 },
  title: { ...type.subheading, minHeight: 28, color: colors.text, padding: 0 },
  meta: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  trailing: { alignItems: "flex-end", gap: spacing.xs },
  removeTarget: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, alignItems: "flex-end", justifyContent: "center" },
  remove: { fontFamily: fontFamily.semiBold, fontSize: font.meta, color: colors.textMuted },
});
