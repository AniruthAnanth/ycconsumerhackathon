import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { OutlinedPillButton, PositionPill, RowDivider } from "@/components/ui";
import { colors, font, fontFamily, layout, ROW_HEIGHT, SCREEN_MARGIN, spacing } from "@/theme";

import type { CanvasAssignment } from "../contract";
import { dueLabel } from "./canvasLogic";

export function AssignmentRow({
  assignment,
  added,
  blocked,
  onAdd,
}: {
  assignment: CanvasAssignment;
  added: boolean;
  /** Flex is full, so this one cannot be added. */
  blocked: boolean;
  onAdd: (assignment: CanvasAssignment) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);

  const add = async () => {
    setAdding(true);
    await onAdd(assignment);
    setAdding(false);
  };

  return (
    <View style={styles.row}>
      <PositionPill slot="flex" />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {assignment.title}
        </Text>
        {/* The deadline gets its own line: after a long course name it was the part cut off. */}
        <Text style={styles.detail} numberOfLines={1}>
          {dueLabel(assignment.dueAt)}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {assignment.courseName}
        </Text>
      </View>
      <OutlinedPillButton label={added ? "Added" : "Add"} disabled={added || blocked || adding} onPress={add} />
      <RowDivider inset={SCREEN_MARGIN} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
  },
  text: { flex: 1, gap: spacing.xs },
  title: { color: colors.text, fontSize: font.title, fontFamily: fontFamily.bold },
  detail: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.meta },
});
