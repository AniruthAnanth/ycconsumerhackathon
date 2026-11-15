import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { proofCameraHref } from "@/components/capture/proofRoute";
import { CheckInPrompt } from "@/components/checkin";
import { ProjectionLine } from "@/components/leaderboards";
import { HomeWidgetSync, LiveActivitySync } from "@/components/liveActivity";
import { AddFlexTask } from "@/components/roster/AddFlexTask";
import { DropBanner } from "@/components/roster/DropBanner";
import { EmptySlotRow } from "@/components/roster/EmptySlotRow";
import { PayBanner } from "@/components/roster/PayBanner";
import { RosterTotal } from "@/components/roster/RosterTotal";
import { Button, OutlinedPillButton, Screen, SectionLabel, TaskRow } from "@/components/ui";
import { backend, type Task } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { flexTasksLeft, splitRoster } from "@/lib/roster";
import { colors, font, spacing } from "@/theme";

export { TabError as ErrorBoundary } from "@/components/social/RouteError";

/**
 * ROSTER, the screen the app opens on every day: this week's lineup as a team
 * sheet, the task to do next one tap from its camera, and the week's total.
 */
export default function RosterScreen() {
  const router = useRouter();
  const { leagueId, membership, league, weekStart, weekNumber } = useCurrentLeague();
  // One lineup scores in every league, so the roster is the same whichever
  // league is selected; the league only decides which drop tasks count.
  const roster = useQuery(
    backend.lineup.roster,
    leagueId ? (weekStart === undefined ? { leagueId } : { leagueId, weekStart }) : "skip",
  );
  const { starters, extras } = splitRoster(roster?.rows ?? []);
  const owesBuyIn = membership !== undefined && !membership.paid && membership.stakeUsd > 0;

  // A week that has ended is shown as it was. Only the week in play, or the
  // next one, can be drafted, so a past week never offers the draft.
  const past = weekStart !== undefined && league !== undefined && weekStart < league.week.startsAt;
  const draft = past ? undefined : () => router.push("/draft");
  const empty = roster !== undefined && roster.rows.length === 0;
  const undrafted = empty && !past && !roster.locked;
  // A locked lineup can't be edited, but it still takes flex tasks, and
  // lineup.addFlexTask always adds to the week in play.
  const takesFlex = roster !== undefined && roster.locked && weekStart === undefined && flexTasksLeft(roster.rows) > 0;

  const row = (task: Task) => (
    <TaskRow
      key={task.taskId}
      task={task}
      highlighted={task.upNext}
      onPress={() => router.push(`/task/${task.taskId}`)}
      // Up Next skips the task sheet: its camera is one tap from here. A Canvas
      // task has no camera, so it keeps the score column and opens the sheet.
      right={
        task.upNext && task.proofType !== "canvas" ? (
          <OutlinedPillButton label="Submit Proof" onPress={() => router.push(proofCameraHref(task))} />
        ) : undefined
      }
    />
  );

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
        <View style={styles.actions}>
          <OutlinedPillButton label="Voice Draft" icon="mic-outline" style={styles.action} onPress={() => router.push("/draft")} />
          <OutlinedPillButton
            label="Week Stats"
            icon="stats-chart-outline"
            style={styles.action}
            onPress={() => router.push({ pathname: "/wrapped", params: { leagueId: leagueId ?? undefined, weekNumber } })}
          />
        </View>
        {empty && past ? (
          <Text style={styles.none}>No lineup this week</Text>
        ) : (
          <>
            <SectionLabel left="Starters" right="Score" />
            {starters.map(({ slot, task }) => (task ? row(task) : <EmptySlotRow key={slot} slot={slot} onPress={draft} />))}
            {extras.length > 0 || takesFlex ? <SectionLabel left="Flex and bonus" /> : null}
            {extras.map(row)}
            {takesFlex ? <AddFlexTask /> : null}
          </>
        )}
      </ScrollView>
      {undrafted ? (
        <Button label="Draft your week" style={styles.draft} onPress={() => router.push("/draft")} />
      ) : empty && past ? null : (
        <>
          {leagueId ? <ProjectionLine leagueId={leagueId} /> : null}
          <RosterTotal total={roster?.total ?? null} bonusPoints={roster?.bonusPoints} bonusLabels={roster?.bonusLabels} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: spacing.md, padding: spacing.md },
  action: { flex: 1 },
  none: { padding: spacing.xl, textAlign: "center", fontSize: font.body, color: colors.textMuted },
  draft: { margin: spacing.md },
});
