import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { OutlinedPillButton, PositionPill } from "@/components/ui";
import { colors, font, hairline, ROW_HEIGHT, spacing } from "@/theme";

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
        <Text style={styles.title} numberOfLines={1}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  text: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: font.title, fontWeight: "700" },
  detail: { color: colors.textMuted, fontSize: font.meta },
});
