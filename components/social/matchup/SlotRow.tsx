import { StyleSheet, Text, View } from "react-native";

import { PositionPill, Score } from "@/components/ui";
import { colors, font, fontFamily, hairline, ROW_HEIGHT, spacing } from "@/theme";

import type { Matchup, TaskRow } from "../contract";
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
        <Text style={[styles.title, mirrored && styles.textRight]} numberOfLines={2}>
          {task.title}
        </Text>
        <Text style={[styles.status, mirrored && styles.textRight]} numberOfLines={1}>
          {statusLine(task)}
        </Text>
      </View>
      <Score value={task.score} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  side: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  sideMirrored: { flexDirection: "row-reverse" },
  text: { flex: 1, gap: 2 },
  textRight: { textAlign: "right" },
  title: { color: colors.text, fontSize: font.body, fontFamily: fontFamily.bold },
  status: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.meta },
  empty: { flex: 1, color: colors.textFaint, fontFamily: fontFamily.regular, fontSize: font.header, textAlign: "center" },
});
