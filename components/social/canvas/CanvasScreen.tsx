import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { Header, OutlinedPillButton, Screen, SectionLabel } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { errorMessage } from "@/lib/errorMessage";
import { colors, font, fontFamily, layout, SCREEN_MARGIN, spacing } from "@/theme";

import { type CanvasAssignment, socialApi } from "../contract";
import { leaveScreen } from "../leave";
import { notify } from "../notify";
import { ScreenState } from "../ScreenState";
import { AssignmentRow } from "./AssignmentRow";
import { flexCount, isFlexFull, isOnRoster, MAX_FLEX_TASKS } from "./canvasLogic";
import { ConnectForm } from "./ConnectForm";

const rowKey = ({ courseId, assignmentId }: CanvasAssignment) => `${courseId}:${assignmentId}`;

export function CanvasScreen() {
  const connect = useMutation(socialApi.canvas.connect);
  const connection = useQuery(socialApi.canvas.connection);
  const listAssignments = useAction(socialApi.canvas.listAssignments);
  const addTask = useMutation(socialApi.canvas.addTask);
  const { leagueId } = useCurrentLeague();
  const rows = useQuery(backend.lineup.roster, leagueId ? { leagueId } : "skip")?.rows;
  const flexFull = rows !== undefined && isFlexFull(rows);

  const [assignments, setAssignments] = useState<CanvasAssignment[] | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  // Stays true from the moment Connect is pressed until its list loads, so a failed list keeps the form and its error.
  const [formOpen, setFormOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());

  const connected = connection?.connected === true;
  const showForm = connection !== undefined && (!connected || formOpen);

  useEffect(() => {
    if (!connected || formOpen || assignments !== null) return;
    let current = true;
    setLoadError(undefined);
    listAssignments()
      .then((list) => current && setAssignments(list))
      .catch((e) => current && setLoadError(errorMessage(e, "Couldn't load your assignments.")));
    return () => {
      current = false;
    };
  }, [connected, formOpen, assignments, attempt, listAssignments]);

  const connectAndLoad = async (baseUrl: string, token: string) => {
    setConnecting(true);
    setFormOpen(true);
    setError(undefined);
    try {
      await connect({ baseUrl, token });
      setAssignments(await listAssignments());
      setFormOpen(false);
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
    setLoadError(undefined);
    setError(undefined);
    setFormOpen(true);
  };

  return (
    <Screen>
      <Header title="Canvas" onBack={leaveScreen} />
      {connection === undefined || (!showForm && assignments === null && !loadError) ? (
        <ScreenState loading />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {showForm ? (
            <ConnectForm busy={connecting} error={error} onConnect={connectAndLoad} />
          ) : assignments === null ? (
            <>
              <Text style={styles.loadError}>{loadError}</Text>
              <OutlinedPillButton label="Try again" onPress={() => setAttempt((n) => n + 1)} style={styles.retry} />
              <Pressable accessibilityRole="button" onPress={changeSchool} style={styles.change}>
                <Text style={styles.changeText}>Change school</Text>
              </Pressable>
            </>
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
  content: { flexGrow: 1, paddingBottom: spacing.xl },
  full: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.meta, paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.sm },
  loadError: { color: colors.danger, fontFamily: fontFamily.regular, fontSize: font.body, padding: SCREEN_MARGIN, textAlign: "center" },
  retry: { alignSelf: "center" },
  change: { alignSelf: "center", minHeight: layout.rowMin, justifyContent: "center", padding: spacing.lg },
  changeText: { color: colors.accent, fontSize: font.body, fontFamily: fontFamily.bold },
});
