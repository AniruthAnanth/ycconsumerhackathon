import { StyleSheet, Text, View } from "react-native";

import { PositionPill, RowDivider, Score } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { BORDER, colors, font, fontFamily, radius, ROW_HEIGHT, SCREEN_MARGIN, spacing } from "@/theme";

import type { Matchup, TaskRow, TaskVeto } from "../contract";
import { SwapEditor } from "../veto/SwapEditor";
import { VetoChip } from "../veto/VetoChip";
import { showsVeto } from "../veto/vetoLogic";
import { slotLeader, statusDot, statusLine } from "./matchupLogic";

type Vetoes = { byTask: Map<Id<"tasks">, TaskVeto>; leagueId: Id<"leagues"> };

/** One slot, mirrored the way a fantasy box score reads: my task | slot | their task, the leading half tinted. */
export function SlotRow({ row, vetoes }: { row: Matchup["rows"][number]; vetoes?: Vetoes }) {
  const mineVeto = row.mine ? vetoes?.byTask.get(row.mine.taskId) : undefined;
  const leader = slotLeader(row);
  return (
    <View>
      <View style={styles.row}>
        <TaskSide task={row.mine} side="mine" leading={leader === "mine"} vetoes={vetoes} />
        <PositionPill slot={row.slot} />
        <TaskSide task={row.theirs} side="theirs" leading={leader === "theirs"} vetoes={vetoes} />
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
 * The title keeps the side's full width so task names don't wrap into a narrow column. The line under
 * it puts the points on the outer edge, then the status dot and status, reading in towards the pill.
 */
function TaskSide({ task, side, leading, vetoes }: { task?: TaskRow; side: "mine" | "theirs"; leading: boolean; vetoes?: Vetoes }) {
  const mirrored = side === "theirs";
  const veto = task ? vetoes?.byTask.get(task.taskId) : undefined;
  if (!task) {
    return (
      <View style={[styles.side, mirrored && styles.sideMirrored]}>
        <Text style={styles.empty}>{"\u2014"}</Text>
      </View>
    );
  }
  const dot = statusDot(task.status);
  return (
    <View style={[styles.stack, leading && styles.leading]}>
      <Text style={[styles.title, mirrored && styles.textRight]} numberOfLines={2}>
        {task.title}
      </Text>
      <View style={[styles.meta, mirrored && styles.sideMirrored]}>
        <Score value={task.score} />
        <View style={[styles.dot, dot === "done" && styles.dotDone, dot === "pending" && styles.dotPending, dot === "open" && styles.dotOpen]} />
        <Text style={[styles.status, mirrored && styles.textRight]} numberOfLines={1}>
          {statusLine(task)}
        </Text>
      </View>
      {veto && vetoes && showsVeto(side, veto) ? (
        <View style={mirrored ? styles.chipRight : styles.chipLeft}>
          <VetoChip veto={veto} leagueId={vetoes.leagueId} />
        </View>
      ) : null}
    </View>
  );
}

const DOT = spacing.sm;

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SCREEN_MARGIN - spacing.xs,
    gap: spacing.xs,
  },
  side: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  sideMirrored: { flexDirection: "row-reverse" },
  stack: { flex: 1, alignSelf: "stretch", justifyContent: "center", gap: spacing.xs, padding: spacing.xs, borderRadius: radius.sm },
  leading: { backgroundColor: colors.accentTint },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  dotDone: { backgroundColor: colors.accent },
  dotPending: { backgroundColor: colors.textMuted },
  dotOpen: { borderWidth: BORDER, borderColor: colors.textFaint },
  swap: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: spacing.sm },
  chipLeft: { alignItems: "flex-start" },
  chipRight: { alignItems: "flex-end" },
  textRight: { textAlign: "right" },
  title: { color: colors.text, fontSize: font.body, fontFamily: fontFamily.bold },
  status: { flex: 1, color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: font.meta },
  empty: { flex: 1, color: colors.textFaint, fontFamily: fontFamily.regular, fontSize: font.header, textAlign: "center" },
});
