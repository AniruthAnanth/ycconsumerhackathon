import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Artwork, artworkForTask } from "@/components/art";
import { Button, Header, Icon, Screen, TaskRow } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { leaveScreen } from "@/lib/leaveScreen";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing, TASK_TEXT_INSET } from "@/theme";

import { howToProve } from "../proofKinds";
import { canSubmitProof, findTask, submitProofHref, toProofTarget } from "./taskSheetRules";

export function TaskSheet({ taskId }: { taskId: string }) {
  const router = useRouter();
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

  // Presented as a form sheet, which starts below the status bar, so only the bottom needs a safe-area inset.
  return (
    <Screen edges={["bottom"]}>
      <Header
        title="Task"
        right={
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="close" size={24} />
          </Pressable>
        }
      />
      {task ? (
        <>
          <View style={styles.hero}>
            <Artwork name={artworkForTask(task.slot, task.title)} size={104} />
          </View>
          <TaskRow task={task} titleLines={3} />
          {canSubmitProof(task.status) ? (
            <Text style={styles.howTo} testID="task-how-to-prove">
              {howToProve(toProofTarget(task))}
            </Text>
          ) : null}
          {canSubmitProof(task.status) ? (
            <View style={styles.action}>
              <Button label="Submit Proof" onPress={() => router.replace(submitProofHref(task))} />
            </View>
          ) : null}
        </>
      ) : null}
      {roster && !task ? <Text style={styles.missing}>That task isn't on your lineup.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: spacing.lg, paddingBottom: spacing.md },
  action: { padding: SCREEN_MARGIN },
  // Starts at the task title's edge, so it reads as part of the row above.
  howTo: { paddingLeft: TASK_TEXT_INSET, paddingRight: SCREEN_MARGIN, paddingTop: spacing.md, color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.body },
  missing: { padding: SCREEN_MARGIN, color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.body },
});
