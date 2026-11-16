import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";

import { proofCameraHref } from "@/components/capture/proofRoute";
import { CheckInPrompt } from "@/components/checkin";
import { HomeWidgetSync, LiveActivitySync } from "@/components/liveActivity";
import { Entrance } from "@/components/motion";
import { AddFlexTask } from "@/components/roster/AddFlexTask";
import { DropBanner } from "@/components/roster/DropBanner";
import { EmptySlotRow } from "@/components/roster/EmptySlotRow";
import { PayBanner } from "@/components/roster/PayBanner";
import { RosterHero } from "@/components/roster/RosterHero";
import { RosterWeekDetails } from "@/components/roster/RosterWeekDetails";
import { Button, EmptyState, OutlinedPillButton, Screen, SectionLabel, TaskRow, useTabBarInset } from "@/components/ui";
import { backend, type Task } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { splitRoster, weekActions } from "@/lib/roster";
import { SCREEN_MARGIN } from "@/theme";

/**
 * ROSTER, the screen the app opens on every day: this week's lineup as a team
 * sheet, the task to do next one tap from its camera, and the week's total.
 */
export function RosterScreen() {
  const router = useRouter();
  const { leagueId, membership, league, weekStart } = useCurrentLeague();
  const bottomInset = useTabBarInset();
  // One lineup scores in every league, so the roster is the same whichever
  // league is selected; the league only decides which drop tasks count.
  const roster = useQuery(
    backend.lineup.roster,
    leagueId ? (weekStart === undefined ? { leagueId } : { leagueId, weekStart }) : "skip",
  );
  const { starters, extras } = splitRoster(roster?.rows ?? []);
  const owesBuyIn = membership !== undefined && !membership.paid && membership.stakeUsd > 0;

  const { canDraft, noLineup, undrafted, takesFlex } = weekActions({
    roster,
    shownWeekStart: weekStart,
    currentWeekStart: league?.week.startsAt,
  });
  const draft = canDraft ? () => router.push("/draft") : undefined;
  // Once the lineup is locked, the next task is why the player opened the app,
  // so it sits right under the hero, above the pills. Its row stays in
  // the sheet below as an ordinary row, so the lineup keeps its five slots.
  // The lineup runs on the calendar week, so it still names a next task after the
  // selected league's week has settled (End Week Now settles one early). That
  // week's result is final, so Roster stops asking for a proof until the next opens.
  const settled = league?.week.status === "settled";
  const lead = roster?.locked && !settled ? roster.rows.find((task) => task.upNext) : undefined;

  const row = (task: Task, upNext: boolean) => (
    <TaskRow
      key={task.taskId}
      task={task}
      highlighted={upNext}
      titleLines={upNext ? 1 : undefined}
      onPress={() => router.push(`/task/${task.taskId}`)}
      // Up Next skips the task sheet: its camera is one tap from here. A Canvas
      // task has no camera, so it keeps the score column and opens the sheet.
      right={
        upNext && task.proofType !== "canvas" ? (
          // A short label keeps the row's text whole at 390 pt; the screen reader still hears the full action.
          <OutlinedPillButton label="Proof" icon="camera" accessibilityLabel="Submit Proof" onPress={() => router.push(proofCameraHref(task))} />
        ) : undefined
      }
    />
  );
  const listed = (task: Task) => row(task, task.upNext && !lead && !settled);

  return (
    <Screen edges={[]}>
      {/* Both render nothing: they keep the lock-screen Live Activity and the home-screen widget current, and are absent in Expo Go. */}
      <LiveActivitySync />
      <HomeWidgetSync />
      {/* One banner at a time, most urgent first: the unpaid buy-in, then a live drop, then the check-in nudge. */}
      {leagueId && owesBuyIn ? (
        <PayBanner leagueId={leagueId} stakeUsd={membership.stakeUsd} />
      ) : leagueId ? (
        <DropBanner leagueId={leagueId} fallback={<CheckInPrompt leagueId={leagueId} />} />
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
            <RosterHero roster={roster} />
          </Entrance>
        ) : null}
        {lead ? <Entrance index={1}>{row(lead, true)}</Entrance> : null}
        {noLineup ? (
          <EmptyState inline message="No lineup this week" />
        ) : (
          <Entrance index={2}>
            <SectionLabel left="Starters" right="Score" />
            {starters.map(({ slot, task }) => (task ? listed(task) : <EmptySlotRow key={slot} slot={slot} onPress={draft} />))}
            {extras.length > 0 || takesFlex ? <SectionLabel left="Flex and bonus" /> : null}
            {extras.map(listed)}
            {takesFlex ? <AddFlexTask /> : null}
            {/* Odds, plan progress, projection and the box-score total wait behind one row: none of them is the next thing to do. */}
            {undrafted || !roster ? null : <RosterWeekDetails roster={roster} />}
          </Entrance>
        )}
      </ScrollView>
      {/* The one way into the draft; Week Wrapped lives on the Feed, so Roster carries no second entry for either. */}
      {undrafted ? <Button label="Draft your week" style={[styles.draft, { marginBottom: bottomInset }]} onPress={() => router.push("/draft")} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  draft: { margin: SCREEN_MARGIN },
});
