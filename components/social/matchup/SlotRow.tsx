import type { ReactNode } from "react";
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { CoachTarget } from "@/components/coach";
import { PositionPill, RowDivider, Score } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { colors, font, fontFamily, radius, ROW_HEIGHT, SCREEN_MARGIN, spacing } from "@/theme";

import type { Matchup, TaskRow, TaskVeto } from "../contract";
import { SwapEditor } from "../veto/SwapEditor";
import { useVetoAction } from "../veto/useVetoAction";
import { VetoChip } from "../veto/VetoChip";
import { showsVeto } from "../veto/vetoLogic";
import { slotLeader, statusLine } from "./matchupLogic";

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
 * it puts the points on the outer edge, then the status word, reading in towards the pill. The word alone
 * carries the status; a dot beside it said the same thing twice.
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
  const body = (
    <>
      <Text style={[styles.title, mirrored && styles.textRight]} numberOfLines={2}>
        {task.title}
      </Text>
      {/* Nothing to say until there is a score or a status, so an open, unscored task is just its title. */}
      {task.score != null || statusLine(task) ? (
        <View style={[styles.meta, mirrored && styles.sideMirrored]}>
          {task.score != null ? <Score value={task.score} /> : null}
          <Text style={[styles.status, mirrored && styles.textRight]} numberOfLines={1}>
            {statusLine(task)}
          </Text>
        </View>
      ) : null}
      {veto && vetoes && showsVeto(side, veto) ? (
        <View style={mirrored ? styles.chipRight : styles.chipLeft}>
          <CoachTarget id="veto">
            <VetoChip veto={veto} leagueId={vetoes.leagueId} />
          </CoachTarget>
        </View>
      ) : null}
    </>
  );
  if (veto && vetoes && side === "theirs" && veto.canVote && !showsVeto(side, veto)) {
    return <LongPressVeto veto={veto} leagueId={vetoes.leagueId} style={[styles.stack, leading && styles.leading]}>{body}</LongPressVeto>;
  }
  return <View style={[styles.stack, leading && styles.leading]}>{body}</View>;
}

/** The first veto on an opponent's task: a long-press (or the screen reader's Veto action) on it. */
function LongPressVeto({ veto, leagueId, style, children }: { veto: TaskVeto; leagueId: Id<"leagues">; style: StyleProp<ViewStyle>; children: ReactNode }) {
  const onVeto = useVetoAction(veto, leagueId);
  return (
    <Pressable
      onLongPress={onVeto}
      accessibilityHint="Long-press to veto"
      accessibilityActions={[{ name: "veto", label: "Veto" }]}
      onAccessibilityAction={(event) => event.nativeEvent.actionName === "veto" && onVeto()}
      style={style}
    >
      {children}
    </Pressable>
  );
}

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
  swap: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: spacing.sm },
  chipLeft: { alignItems: "flex-start" },
  chipRight: { alignItems: "flex-end" },
  textRight: { textAlign: "right" },
  title: { color: colors.text, fontSize: font.body, fontFamily: fontFamily.bold },
  status: { flex: 1, color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: font.meta },
  empty: { flex: 1, color: colors.textFaint, fontFamily: fontFamily.regular, fontSize: font.header, textAlign: "center" },
});
