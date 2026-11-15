import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { CanvasAssignment } from "../contract";
import { colors, OutlinedPillButton, PositionPill } from "../kit";
import { dueLabel } from "./canvasLogic";

export function AssignmentRow({
  assignment,
  added,
  onAdd,
}: {
  assignment: CanvasAssignment;
  added: boolean;
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
      <PositionPill slot="mind" />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {assignment.title}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {assignment.courseName} · {dueLabel(assignment.dueAt)}
        </Text>
      </View>
      <OutlinedPillButton label={added ? "Added" : "Add"} disabled={added || adding} onPress={add} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  text: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  detail: { color: colors.muted, fontSize: 13 },
});
