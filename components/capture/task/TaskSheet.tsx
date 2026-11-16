import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DonePoints, StrikeThrough, useDoneDim, useDoneMoment } from "@/components/motion";
import { Button, EmptyState, Header, PositionPill, sheetNeedsClose } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { leaveScreen } from "@/lib/leaveScreen";
import { formatScore, taskPlaceLine, taskRowLabel, taskStatusLine } from "@/lib/taskText";
import { colors, layout, SCREEN_MARGIN, slotTint, spacing, tabular, type } from "@/theme";

import { howToProve } from "../proofKinds";
import { PinPlaceButton } from "./PinPlaceButton";
import { canSubmitProof, findTask, submitProofHref, toProofTarget } from "./taskSheetRules";

// Where the task title starts: past the slot pill. The how-to line starts on the same edge.
const TEXT_INSET = SCREEN_MARGIN + layout.pillColumn + layout.columnGap;

/**
 * The task, alone: its slot pill (the one place the slot shows), the title with its proof type and
 * due day, the points, how to prove it and Submit Proof. The sheet fits its content.
 */
export function TaskSheet({ taskId }: { taskId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { leagueId, weekStart } = useCurrentLeague();
  // A lineup belongs to the player and the week, not to a league, so the sheet works before the
  // player has joined one; the league only adds that league's drop tasks.
  const roster = useQuery(backend.lineup.roster, {
    ...(leagueId && { leagueId }),
    ...(weekStart !== undefined && { weekStart }),
  });
  const task = roster ? findTask(roster.rows, taskId) : undefined;
  // Opened from a link or after a reload there is no screen underneath to go back to.
  const close = () => leaveScreen("/(tabs)");
  const provable = task !== undefined && canSubmitProof(task.status);
  // An open task's how-to line names its proof type, target and place, so the row above it keeps only the due day.
  const meta = task ? (provable ? task.dueLabel : taskStatusLine(task)) : undefined;
  const place = task && !provable ? taskPlaceLine(task) : undefined;
  const { done, animate } = useDoneMoment(task?.status, { id: task?.taskId });
  const dim = useDoneDim(done, animate);

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
      {sheetNeedsClose ? <Header title="Task" onClose={close} /> : null}
      {task ? (
        <>
          <View style={styles.row} accessible accessibilityLabel={taskRowLabel(task, false)}>
            <Animated.View style={dim}>
              <PositionPill slot={task.slot} />
            </Animated.View>
            <View style={styles.text}>
              <StrikeThrough style={styles.title} numberOfLines={3} done={done} animate={animate}>
                {task.title}
              </StrikeThrough>
              {meta || place ? (
                <Animated.View style={[styles.lines, dim]}>
                  {meta ? <Text style={styles.meta}>{meta}</Text> : null}
                  {place ? <Text style={styles.meta}>{place}</Text> : null}
                </Animated.View>
              ) : null}
            </View>
            {done ? (
              <DonePoints points={task.score ?? task.points} animate={animate} color={slotTint[task.slot].fg} />
            ) : (
              <Text style={styles.points}>{`${formatScore(task.score ?? task.points)} pts`}</Text>
            )}
          </View>
          {provable ? (
            <>
              <Text style={styles.howTo} testID="task-how-to-prove">
                {howToProve(toProofTarget(task))}
              </Text>
              <View style={styles.action}>
                {task.proofType === "photo_location" && !task.place ? (
                  <PinPlaceButton taskId={task.taskId} name={task.title} />
                ) : (
                  <Button label="Submit Proof" haptic="medium" onPress={() => router.replace(submitProofHref(task))} />
                )}
              </View>
            </>
          ) : null}
        </>
      ) : null}
      {roster === undefined ? <EmptyState loading inline /> : null}
      {roster && !task ? <EmptyState message="That task isn't on your lineup." inline /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Room under the native grabber, so it doesn't sit on the title.
  sheet: { backgroundColor: colors.background, paddingTop: spacing.md },
  row: {
    minHeight: layout.rowMin,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.md,
  },
  text: { flex: 1, gap: spacing.xs },
  lines: { gap: spacing.xs },
  title: { ...type.subheading, color: colors.text },
  meta: { ...type.small, color: colors.textMuted },
  // Never shrinks, so "40 pts" stays on one line at the trailing edge.
  points: { flexShrink: 0, ...type.label, color: colors.text, textAlign: "right", ...tabular },
  howTo: { paddingLeft: TEXT_INSET, paddingRight: SCREEN_MARGIN, ...type.body, color: colors.textMuted },
  action: { paddingHorizontal: SCREEN_MARGIN, paddingTop: spacing.lg },
});
