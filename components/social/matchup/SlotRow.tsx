import { StyleSheet, Text, View } from "react-native";

import { PositionPill, RowDivider, Score } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { colors, font, fontFamily, ROW_HEIGHT, SCREEN_MARGIN, spacing } from "@/theme";

import type { Matchup, TaskRow, TaskVeto } from "../contract";
import { SwapEditor } from "../veto/SwapEditor";
import { VetoChip } from "../veto/VetoChip";
import { showsVeto } from "../veto/vetoLogic";
import { statusLine } from "./matchupLogic";

type Vetoes = { byTask: Map<Id<"tasks">, TaskVeto>; leagueId: Id<"leagues"> };

export function SlotRow({ row, vetoes }: { row: Matchup["rows"][number]; vetoes?: Vetoes }) {
  const mineVeto = row.mine ? vetoes?.byTask.get(row.mine.taskId) : undefined;
  return (
    <View>
      <View style={styles.row}>
        <TaskSide task={row.mine} side="mine" vetoes={vetoes} />
        <PositionPill slot={row.slot} />
        <TaskSide task={row.theirs} side="theirs" vetoes={vetoes} />
      </View>
      {mineVeto?.struck ? (
        <View style={styles.swap}>
          <SwapEditor veto={mineVeto} />
        </View>
      ) : null}
      <RowDivider inset={SCREEN_MARGIN} />
    </View>
  );
}

/**
 * Mirrored around the position pill. The title takes the side's full width so task names don't wrap
 * into a narrow column; the score sits on the line under it, nearest the centre.
 */
function TaskSide({ task, side, vetoes }: { task?: TaskRow; side: "mine" | "theirs"; vetoes?: Vetoes }) {
  const mirrored = side === "theirs";
  const veto = task ? vetoes?.byTask.get(task.taskId) : undefined;
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
      {veto && vetoes && showsVeto(side, veto) ? (
        <View style={mirrored ? styles.chipRight : styles.chipLeft}>
          <VetoChip veto={veto} leagueId={vetoes.leagueId} />
        </View>
      ) : null}
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
  swap: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: spacing.sm },
  chipLeft: { alignItems: "flex-start" },
  chipRight: { alignItems: "flex-end" },
  textRight: { textAlign: "right" },
  title: { color: colors.text, fontSize: font.body, fontFamily: fontFamily.bold },
  status: { flex: 1, color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: font.meta },
  empty: { flex: 1, color: colors.textFaint, fontFamily: fontFamily.regular, fontSize: font.header, textAlign: "center" },
});
