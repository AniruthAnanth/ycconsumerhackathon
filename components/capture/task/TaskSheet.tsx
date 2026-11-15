import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Artwork, artworkForTask } from "@/components/art";
import { Button, Header, Icon, Screen, TaskRow } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { leaveScreen } from "@/lib/leaveScreen";
import { colors, font, fontFamily, spacing } from "@/theme";

import { canSubmitProof, findTask, submitProofHref } from "./taskSheetRules";

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
          <TaskRow task={task} />
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
  action: { padding: spacing.lg },
  missing: { padding: spacing.lg, color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.body },
});
