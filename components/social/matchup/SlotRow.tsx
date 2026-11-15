import { StyleSheet, Text, View } from "react-native";

import type { Matchup, TaskRow } from "../contract";
import { colors, PositionPill, Score } from "../kit";
import { statusLine } from "./matchupLogic";

export function SlotRow({ row }: { row: Matchup["rows"][number] }) {
  return (
    <View style={styles.row}>
      <TaskSide task={row.mine} side="mine" />
      <PositionPill slot={row.slot} />
      <TaskSide task={row.theirs} side="theirs" />
    </View>
  );
}

/** Mirrored around the position pill: the score always sits nearest the centre. */
function TaskSide({ task, side }: { task?: TaskRow; side: "mine" | "theirs" }) {
  const mirrored = side === "theirs";
  if (!task) {
    return (
      <View style={[styles.side, mirrored && styles.sideMirrored]}>
        <Text style={styles.empty}>{"\u2014"}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.side, mirrored && styles.sideMirrored]}>
      <View style={styles.text}>
        <Text style={[styles.title, mirrored && styles.textRight]} numberOfLines={1}>
          {task.title}
        </Text>
        <Text style={[styles.status, mirrored && styles.textRight]} numberOfLines={1}>
          {statusLine(task)}
        </Text>
      </View>
      <View style={styles.score}>
        <Score value={task.score} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  side: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  sideMirrored: { flexDirection: "row-reverse" },
  text: { flex: 1, gap: 2 },
  textRight: { textAlign: "right" },
  title: { color: colors.text, fontSize: 14, fontWeight: "700" },
  status: { color: colors.muted, fontSize: 12 },
  score: { minWidth: 40 },
  empty: { flex: 1, color: colors.muted, fontSize: 17, textAlign: "center" },
});
