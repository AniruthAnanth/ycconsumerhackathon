import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Header, Screen } from "@/components/ui";
import { Artwork } from "@/components/art";
import { SAMPLE_TRANSCRIPT, useDevFlags } from "@/lib/devFlags";
import { leaveScreen } from "@/lib/leaveScreen";
import { colors, MIN_TARGET, SCREEN_MARGIN, spacing, type } from "@/theme";

import { DraftLineup } from "./DraftLineup";
import { RecordButton } from "./RecordButton";
import { TranscriptView } from "./TranscriptView";
import { TypedDraft } from "./TypedDraft";
import { useVoiceDraft } from "./useVoiceDraft";

export function VoiceDraftScreen() {
  const router = useRouter();
  const { sampleVoice } = useDevFlags();
  const draft = useVoiceDraft();
  const { state } = draft;
  const [typedWeek, setTypedWeek] = useState(sampleVoice ? SAMPLE_TRANSCRIPT : "");

  // The lineup is on screen the moment the draft returns: the transcript types itself out above
  // it for a second at most, and the tasks never wait for that.
  const showsLineup = state.phase === "revealing" || state.phase === "review" || state.phase === "locking";
  const showsTyped = state.phase === "idle" && (sampleVoice || state.micUnavailable);
  // Only a refused lock leaves an error on the reviewed lineup. The player needs a way on from
  // it, because after joining the back arrow leads to Join again, not to Roster.
  const lockRefused = state.phase === "review" && state.error !== null;

  return (
    <Screen>
      <Header
        title="Voice Draft"
        onBack={() => leaveScreen("/(tabs)")}
        right={
          state.phase === "review" ? (
            <Pressable accessibilityRole="button" onPress={draft.redo} hitSlop={8}>
              <Text style={styles.redo}>Redo</Text>
            </Pressable>
          ) : undefined
        }
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.sunny}>
            <Artwork name="sunny" size={80} />
          </View>
          {draft.weekNote ? <Text style={styles.weekNote}>{draft.weekNote}</Text> : null}
          {showsLineup ? null : (
            <View style={styles.recorder}>
              <RecordButton
                recording={state.phase === "recording"}
                disabled={state.phase === "drafting" || state.phase === "revealing"}
                durationMillis={draft.durationMillis}
                level={draft.level}
                onPress={draft.toggleRecording}
              />
            </View>
          )}
          <View style={styles.transcript}>
            <TranscriptView phase={state.phase} transcript={state.transcript} onRevealFinished={draft.finishReveal} />
          </View>
          {showsTyped ? (
            <View style={styles.transcript}>
              <TypedDraft value={typedWeek} onChangeText={setTypedWeek} onSubmit={() => draft.draftFromText(typedWeek)} />
            </View>
          ) : null}
          {showsLineup ? (
            <View style={styles.lineup}>
              <DraftLineup
                tasks={state.tasks}
                editable={state.phase === "review"}
                onRename={draft.renameTask}
                onRemove={draft.removeTask}
              />
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          {state.error ? <Text style={styles.error}>{state.error}</Text> : null}
          <Button label="Lock Lineup" onPress={draft.lockLineup} disabled={!draft.canLock} loading={state.phase === "locking"} />
          {lockRefused ? (
            <Pressable accessibilityRole="button" style={styles.leave} onPress={() => router.replace("/(tabs)")} hitSlop={8}>
              <Text style={styles.redo}>Go to Roster</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  sunny: { alignItems: "center", paddingBottom: spacing.md },
  weekNote: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: spacing.md, textAlign: "center", ...type.small, color: colors.textMuted },
  recorder: { alignItems: "center" },
  transcript: { paddingHorizontal: SCREEN_MARGIN, paddingTop: spacing.lg },
  lineup: { paddingTop: spacing.md },
  footer: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.md, gap: spacing.sm },
  error: { ...type.body, color: colors.danger },
  leave: { alignSelf: "center", minHeight: MIN_TARGET, justifyContent: "center" },
  redo: { ...type.label, color: colors.accent },
});
