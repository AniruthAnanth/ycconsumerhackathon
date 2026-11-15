import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Button, Header, Icon, Screen, TaskRow } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { spacing } from "@/theme";

import { canSubmitProof, findTask, submitProofHref } from "./taskSheet";

export function TaskSheet({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { leagueId, weekStart } = useCurrentLeague();
  const roster = useQuery(backend.lineup.roster, leagueId ? { leagueId, ...(weekStart !== undefined && { weekStart }) } : "skip");
  const task = roster ? findTask(roster.rows, taskId) : undefined;

  return (
    <Screen>
      <Header
        title="Task"
        right={
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="close" size={24} />
          </Pressable>
        }
      />
      {task ? (
        <>
          <TaskRow task={task} />
          {canSubmitProof(task.status) ? (
            <View style={styles.action}>
              <Button label="Submit Proof" onPress={() => router.replace(submitProofHref(task))} />
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { padding: spacing.lg },
});
