import { StyleSheet, Text, View } from "react-native";

import { PositionPill, RowDivider, Score } from "@/components/ui";
import { colors, font, fontFamily, ROW_HEIGHT, SCREEN_MARGIN, spacing } from "@/theme";

import type { Matchup, TaskRow } from "../contract";
import { statusLine } from "./matchupLogic";

export function SlotRow({ row }: { row: Matchup["rows"][number] }) {
  return (
    <View style={styles.row}>
      <TaskSide task={row.mine} side="mine" />
      <PositionPill slot={row.slot} />
      <TaskSide task={row.theirs} side="theirs" />
      <RowDivider inset={SCREEN_MARGIN} />
    </View>
  );
}

/**
 * Mirrored around the position pill. The title takes the side's full width so task names don't wrap
 * into a narrow column; the score sits on the line under it, nearest the centre.
 */
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
    <View style={styles.stack}>
      <Text style={[styles.title, mirrored && styles.textRight]} numberOfLines={2}>
        {task.title}
      </Text>
      <View style={[styles.meta, mirrored && styles.sideMirrored]}>
        <Text style={[styles.status, mirrored && styles.textRight]} numberOfLines={1}>
          {statusLine(task)}
        </Text>
        <Score value={task.score} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SCREEN_MARGIN,
    gap: spacing.sm,
  },
  side: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  sideMirrored: { flexDirection: "row-reverse" },
  stack: { flex: 1, gap: spacing.xs },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  textRight: { textAlign: "right" },
  title: { color: colors.text, fontSize: font.body, fontFamily: fontFamily.bold },
  status: { flex: 1, color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: font.meta },
  empty: { flex: 1, color: colors.textFaint, fontFamily: fontFamily.regular, fontSize: font.header, textAlign: "center" },
});
