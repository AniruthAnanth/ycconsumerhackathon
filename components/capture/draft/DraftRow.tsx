import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Avatar, PositionPill, Score, taskPlaceLine, taskStatusLine } from "@/components/ui";
import { ROW_HEIGHT, colors, font, hairline, spacing } from "@/theme";

import { canRemoveTask } from "./lineupEdit";
import type { DraftTask } from "../backend";

type Props = {
  task: DraftTask;
  editable: boolean;
  onRename: (title: string) => void;
  onRemove: () => void;
};

/** Laid out like the shared TaskRow, whose title is static text: here the title edits in place and points are read-only. */
export function DraftRow({ task, editable, onRename, onRemove }: Props) {
  const place = taskPlaceLine(task);
  return (
    <View style={styles.row}>
      <PositionPill slot={task.slot} />
      <Avatar slot={task.slot} />
      <View style={styles.text}>
        <TextInput
          style={styles.title}
          value={task.title}
          onChangeText={onRename}
          editable={editable}
          placeholder="Task"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="Task title"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
        />
        <Text style={styles.meta} numberOfLines={1}>
          {taskStatusLine(task)}
        </Text>
        {place ? (
          <Text style={styles.meta} numberOfLines={1}>
            {place}
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        <Score value={task.points} />
        {editable && canRemoveTask(task) ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${task.title}`} onPress={onRemove} hitSlop={8}>
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
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  text: { flex: 1, gap: 1 },
  title: { fontSize: font.title, fontWeight: "700", color: colors.text, padding: 0 },
  meta: { fontSize: font.meta, color: colors.textMuted },
  trailing: { alignItems: "flex-end", gap: spacing.xs },
  remove: { fontSize: font.meta, color: colors.textMuted },
});
