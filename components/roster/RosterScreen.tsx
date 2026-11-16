import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { proofCameraHref } from "@/components/capture/proofRoute";
import { CoachTarget, CoachTour } from "@/components/coach";
import { HomeWidgetSync, LiveActivitySync } from "@/components/liveActivity";
import { Entrance } from "@/components/motion";
import { AddFlexTask } from "@/components/roster/AddFlexTask";
import { DropBanner } from "@/components/roster/DropBanner";
import { EmptySlotRow } from "@/components/roster/EmptySlotRow";
import { PayBanner } from "@/components/roster/PayBanner";
import { RosterHero } from "@/components/roster/RosterHero";
import { SunnyPrompt } from "@/components/social/sunny/SunnyPrompt";
import { RosterWeekDetails } from "@/components/roster/RosterWeekDetails";
import {
  Button,
  EmptyState,
  OutlinedPillButton,
  Screen,
  SectionLabel,
  TaskRow,
  usePinnedTabBarInset,
  useTabBarInset,
} from "@/components/ui";
import { backend, type Task } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { sharedDueLabel, splitRoster, weekActions } from "@/lib/roster";
import { colors, SCREEN_MARGIN, spacing, TASK_TEXT_INSET } from "@/theme";

/**
 * ROSTER, the screen the app opens on every day: this week's lineup as a team
 * sheet, with the task to do next highlighted in place and its camera one tap away.
 * Each fact shows once: the hero carries the score, the header the due day, the row the task.
 */
export function RosterScreen() {
  const router = useRouter();
  const { leagueId, membership, league, weekStart } = useCurrentLeague();
  const bottomInset = useTabBarInset();
  const pinnedInset = usePinnedTabBarInset();
  // One lineup scores in every league, so the roster is the same whichever
  // league is selected; the league only decides which drop tasks count.
  const roster = useQuery(
    backend.lineup.roster,
    leagueId
      ? weekStart === undefined
        ? { leagueId }
        : { leagueId, weekStart }
      : "skip",
  );
  const { starters, extras } = splitRoster(roster?.rows ?? []);
  const owesBuyIn =
    membership !== undefined && !membership.paid && membership.stakeUsd > 0;

  const { canDraft, noLineup, undrafted, takesFlex } = weekActions({
    roster,
    shownWeekStart: weekStart,
    currentWeekStart: league?.week.startsAt,
  });
  const draft = canDraft ? () => router.push("/draft") : undefined;
  // The lineup runs on the calendar week, so it still names a next task after the
  // selected league's week has settled (End Week Now settles one early). That
  // week's result is final, so Roster stops asking for a proof until the next opens.
  const settled = league?.week.status === "settled";
  const due = sharedDueLabel(roster?.rows ?? []);
  // The tour's "tap a task" step points at the task to do next, else the first one in the lineup.
  const coachTaskId = (
    roster?.rows.find((task) => task.upNext) ??
    starters.find(({ task }) => task)?.task
  )?.taskId;

  // The Up Next task is highlighted where it sits in the lineup rather than repeated above it,
  // and its camera button sits under the row so the title keeps the row's full width.
  const listed = (task: Task) => {
    const upNext = task.upNext && !settled;
    const canProve = upNext && roster?.locked && task.proofType !== "canvas";
    const row = (
      <TaskRow
        task={task}
        highlighted={upNext}
        onPress={() => router.push(`/task/${task.taskId}`)}
      />
    );
    return (
      <View key={task.taskId}>
        {task.taskId === coachTaskId ? (
          <CoachTarget id="task">{row}</CoachTarget>
        ) : (
          row
        )}
        {canProve ? (
          <View style={styles.proof}>
            <OutlinedPillButton
              label="Submit Proof"
              icon="camera"
              onPress={() => router.push(proofCameraHref(task))}
            />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <CoachTour
      tour="roster"
      ready={roster !== undefined && !undrafted && !noLineup}
    >
      <Screen edges={[]}>
        {/* Both render nothing: they keep the lock-screen Live Activity and the home-screen widget current, and are absent in Expo Go. */}
        <LiveActivitySync />
        <HomeWidgetSync />
        {/* One banner at a time: the unpaid buy-in, else a live drop with its deadline. Submit Proof under the Up Next row covers the rest. */}
        {leagueId && owesBuyIn ? (
          <PayBanner leagueId={leagueId} stakeUsd={membership.stakeUsd} />
        ) : leagueId ? (
          <DropBanner leagueId={leagueId} />
        ) : null}
        {/* The flex field sits low in the list: let a tap on Add land while the keyboard is up, and keep the field above it. */}
        {/* With the Draft button under the list, the button clears the tab bar and the list stops above it. */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: undrafted ? 0 : bottomInset }}
          scrollIndicatorInsets={{ bottom: undrafted ? 0 : bottomInset }}
        >
          {leagueId ? (
            <Entrance index={0}>
              <CoachTarget id="score">
                <RosterHero roster={roster} />
              </CoachTarget>
            </Entrance>
          ) : null}
          {noLineup ? (
            <EmptyState inline message="No lineup this week" />
          ) : (
            <Entrance index={1}>
              <SectionLabel left="This week's tasks" right={due} />
              <CoachTarget id="tasks">
                {starters.map(({ slot, task }) =>
                  task ? (
                    listed(task)
                  ) : (
                    <EmptySlotRow key={slot} slot={slot} onPress={draft} />
                  ),
                )}
              </CoachTarget>
              <SunnyPrompt screen="roster" />
              {extras.length > 0 || takesFlex ? (
                <SectionLabel left="Extra" />
              ) : null}
              {extras.map(listed)}
              {takesFlex ? <AddFlexTask /> : null}
              {/* Odds, projection and bonuses wait behind one row: none of them is the next thing to do. */}
              {undrafted || !roster ? null : (
                <RosterWeekDetails roster={roster} />
              )}
            </Entrance>
          )}
        </ScrollView>
        {/* The one way into the draft; Week Wrapped lives on the Feed, so Roster carries no second entry for either. */}
        {undrafted ? (
          <Button
            label="Draft your week"
            style={[styles.draft, { marginBottom: pinnedInset }]}
            onPress={() => router.push("/draft")}
          />
        ) : null}
      </Screen>
    </CoachTour>
  );
}

const styles = StyleSheet.create({
  draft: { margin: SCREEN_MARGIN },
  // The highlighted row's tint continues under the button, which starts on the row's text edge.
  proof: {
    alignItems: "flex-start",
    paddingLeft: TASK_TEXT_INSET,
    paddingRight: SCREEN_MARGIN,
    paddingBottom: spacing.md,
    backgroundColor: colors.accentTint,
  },
});
