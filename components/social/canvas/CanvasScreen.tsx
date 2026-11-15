import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { Header, Screen, SectionLabel } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, font, spacing } from "@/theme";

import { type CanvasAssignment, socialApi } from "../contract";
import { errorMessage } from "../errorMessage";
import { leaveScreen } from "../leave";
import { notify } from "../notify";
import { ScreenState } from "../ScreenState";
import { AssignmentRow } from "./AssignmentRow";
import { flexCount, isFlexFull, isOnRoster, MAX_FLEX_TASKS } from "./canvasLogic";
import { ConnectForm } from "./ConnectForm";

const rowKey = ({ courseId, assignmentId }: CanvasAssignment) => `${courseId}:${assignmentId}`;

export function CanvasScreen() {
  const connect = useMutation(socialApi.canvas.connect);
  const listAssignments = useAction(socialApi.canvas.listAssignments);
  const addTask = useMutation(socialApi.canvas.addTask);
  const { leagueId } = useCurrentLeague();
  const rows = useQuery(backend.lineup.roster, leagueId ? { leagueId } : "skip")?.rows;
  const flexFull = rows !== undefined && isFlexFull(rows);

  const [assignments, setAssignments] = useState<CanvasAssignment[] | null>(null);
  const [checking, setChecking] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());

  // No query says whether the player is connected, so a failed list on mount just means "show the form".
  useEffect(() => {
    listAssignments()
      .then(setAssignments)
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, [listAssignments]);

  const connectAndLoad = async (baseUrl: string, token: string) => {
    setConnecting(true);
    setError(undefined);
    try {
      await connect({ baseUrl, token });
      setAssignments(await listAssignments());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setConnecting(false);
    }
  };

  const add = async (assignment: CanvasAssignment) => {
    try {
      await addTask({
        courseId: assignment.courseId,
        assignmentId: assignment.assignmentId,
        title: assignment.title,
      });
      setAdded((current) => new Set(current).add(rowKey(assignment)));
    } catch (e) {
      notify("Couldn't add assignment", errorMessage(e));
    }
  };

  const changeSchool = () => {
    setAssignments(null);
    setError(undefined);
  };

  return (
    <Screen>
      <Header title="Canvas" onBack={leaveScreen} />
      {checking ? (
        <ScreenState loading />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {assignments === null ? (
            <ConnectForm busy={connecting} error={error} onConnect={connectAndLoad} />
          ) : (
            <>
              <SectionLabel left="Upcoming" />
              {flexFull && rows ? (
                <Text style={styles.full}>
                  Flex is full: {flexCount(rows)} of {MAX_FLEX_TASKS} flex tasks this week.
                </Text>
              ) : null}
              {assignments.length === 0 ? (
                <ScreenState message="No upcoming assignments" />
              ) : (
                assignments.map((assignment) => (
                  <AssignmentRow
                    key={rowKey(assignment)}
                    assignment={assignment}
                    added={added.has(rowKey(assignment)) || (rows !== undefined && isOnRoster(rows, assignment.title))}
                    blocked={flexFull}
                    onAdd={add}
                  />
                ))
              )}
              <Pressable accessibilityRole="button" onPress={changeSchool} style={styles.change}>
                <Text style={styles.changeText}>Change school</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  full: { color: colors.textMuted, fontSize: font.meta, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  change: { alignSelf: "center", padding: spacing.lg },
  changeText: { color: colors.accent, fontSize: font.body, fontWeight: "700" },
});
