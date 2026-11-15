import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { proofCameraHref } from "@/components/capture/proofRoute";
import { CheckInPrompt } from "@/components/checkin";
import { ProjectionLine } from "@/components/leaderboards";
import { HomeWidgetSync, LiveActivitySync } from "@/components/liveActivity";
import { Entrance } from "@/components/motion";
import { AddFlexTask } from "@/components/roster/AddFlexTask";
import { DropBanner } from "@/components/roster/DropBanner";
import { EmptySlotRow } from "@/components/roster/EmptySlotRow";
import { PayBanner } from "@/components/roster/PayBanner";
import { RosterHero } from "@/components/roster/RosterHero";
import { RosterTotal } from "@/components/roster/RosterTotal";
import { Button, OutlinedPillButton, Screen, SectionLabel, TaskRow } from "@/components/ui";
import { backend, type Task } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { splitRoster, weekActions } from "@/lib/roster";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing } from "@/theme";

/**
 * ROSTER, the screen the app opens on every day: this week's lineup as a team
 * sheet, the task to do next one tap from its camera, and the week's total.
 */
export function RosterScreen() {
  const router = useRouter();
  const { leagueId, membership, league, weekStart } = useCurrentLeague();
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
      onPress={() => router.push(`/task/${task.taskId}`)}
      // Up Next skips the task sheet: its camera is one tap from here. A Canvas
      // task has no camera, so it keeps the score column and opens the sheet.
      right={
        upNext && task.proofType !== "canvas" ? (
          <OutlinedPillButton label="Submit Proof" onPress={() => router.push(proofCameraHref(task))} />
        ) : undefined
      }
    />
  );
  const listed = (task: Task) => row(task, task.upNext && !lead && !settled);

  return (
    <Screen edges={["bottom"]}>
      {/* One 44 pt line that asks for the check-in to do right now; nothing when there is none. */}
      <CheckInPrompt leagueId={leagueId} />
      {/* Both render nothing: they keep the lock-screen Live Activity and the home-screen widget current, and are absent in Expo Go. */}
      <LiveActivitySync />
      <HomeWidgetSync />
      {leagueId ? <DropBanner leagueId={leagueId} /> : null}
      {leagueId && owesBuyIn ? <PayBanner leagueId={leagueId} stakeUsd={membership.stakeUsd} /> : null}
      {/* The flex field sits low in the list: let a tap on Add land while the keyboard is up, and keep the field above it. */}
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {leagueId ? (
          <Entrance index={0}>
            <RosterHero roster={roster} />
          </Entrance>
        ) : null}
        {lead ? <Entrance index={1}>{row(lead, true)}</Entrance> : null}
        {noLineup ? (
          <Text style={styles.none}>No lineup this week</Text>
        ) : (
          <Entrance index={2}>
            <SectionLabel left="Starters" right="Score" />
            {starters.map(({ slot, task }) => (task ? listed(task) : <EmptySlotRow key={slot} slot={slot} onPress={draft} />))}
            {extras.length > 0 || takesFlex ? <SectionLabel left="Flex and bonus" /> : null}
            {extras.map(listed)}
            {takesFlex ? <AddFlexTask /> : null}
            {/* The hero already leads with the score, so the box-score total closes the sheet instead of pinning a footer over the starters. */}
            {undrafted ? null : (
              <>
                {leagueId ? <ProjectionLine leagueId={leagueId} /> : null}
                <RosterTotal total={roster?.total ?? null} bonusPoints={roster?.bonusPoints} bonusLabels={roster?.bonusLabels} />
              </>
            )}
          </Entrance>
        )}
      </ScrollView>
      {/* The one way into the draft; Week Wrapped lives on the Feed, so Roster carries no second entry for either. */}
      {undrafted ? <Button label="Draft your week" style={styles.draft} onPress={() => router.push("/draft")} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  none: { padding: spacing.xl, textAlign: "center", fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted },
  draft: { margin: SCREEN_MARGIN },
});
