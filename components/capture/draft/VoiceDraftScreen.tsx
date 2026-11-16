import { useNavigation, usePreventRemove, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";
import Animated from "react-native-reanimated";

import { confirmAction } from "@/components/social/notify";
import { Button, Header, LargeTitle, Screen, useCollapsingHeader } from "@/components/ui";
import { Sunny, type SunnyMood } from "@/components/art";
import { SAMPLE_TRANSCRIPT, useDevFlags } from "@/lib/devFlags";
import { leaveScreen } from "@/lib/leaveScreen";
import { colors, fontFamily, hairline, MIN_TARGET, ROW_HEIGHT, SCREEN_MARGIN, spacing, type } from "@/theme";

import { DraftLineup } from "./DraftLineup";
import { hasUnsavedDraft } from "./draftState";
import { RecordButton } from "./RecordButton";
import { TranscriptView } from "./TranscriptView";
import { TypedDraft } from "./TypedDraft";
import { useSpeakingPrompt } from "./useSpeakingPrompt";
import { useVoiceDraft } from "./useVoiceDraft";

export function VoiceDraftScreen() {
  const router = useRouter();
  const { sampleVoice } = useDevFlags();
  const draft = useVoiceDraft();
  const { state } = draft;
  const [typedWeek, setTypedWeek] = useState(sampleVoice ? SAMPLE_TRANSCRIPT : "");
  const scroll = useRef<ScrollViewInstance>(null);
  // The typed box and "Draft from text" are the last things on the page, so once the keyboard is
  // up the page scrolls to its end to keep them above it (ANI-52).
  const revealTypedWeek = () => {
    const shown = Keyboard.addListener("keyboardDidShow", () => {
      shown.remove();
      scroll.current?.scrollToEnd({ animated: true });
    });
  };
  const prompt = useSpeakingPrompt(state.phase === "idle");
  const sunnyMood: SunnyMood =
    state.phase === "recording" ? "listening" : state.phase === "drafting" || state.phase === "locking" ? "thinking" : state.phase === "review" ? "success" : state.phase === "idle" ? "waiting" : "idle";
  const navigation = useNavigation();
  const { scrollY, onScroll, contentInsetTop } = useCollapsingHeader();

  // Close, Back from the first step, the hardware back button and the iOS swipe all remove the
  // screen, so one guard asks before any of them throws away an unlocked lineup.
  usePreventRemove(hasUnsavedDraft(state, typedWeek), ({ data }) =>
    confirmAction({
      title: "Discard this draft?",
      message: "Your lineup isn't locked yet.",
      confirmLabel: "Discard",
      onConfirm: () => navigation.dispatch(data.action),
    }),
  );
  const leave = () => leaveScreen("/(tabs)");
  // Back on the review step goes back to recording rather than out of the screen.
  const back = () =>
    state.phase === "review"
      ? confirmAction({ title: "Discard this lineup?", message: "You'll start the draft again.", confirmLabel: "Discard", onConfirm: draft.redo })
      : leave();

  // The lineup is on screen the moment the draft returns: the transcript types itself out above
  // it for a second at most, and the tasks never wait for that.
  const showsLineup = state.phase === "revealing" || state.phase === "review" || state.phase === "locking";
  const showsTyped = state.phase === "idle" && (sampleVoice || state.micUnavailable);
  // Only a refused lock leaves an error on the reviewed lineup. The player needs a way on from
  // it, because after joining the back arrow leads to Join again, not to Roster.
  const lockRefused = state.phase === "review" && state.error !== null;

  return (
    <Screen edges={["bottom"]}>
      <Header
        title="Voice Draft"
        scrollY={scrollY}
        onBack={state.phase === "locking" ? undefined : back}
        onClose={state.phase === "locking" ? undefined : leave}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Dragging the page puts the keyboard away, and the content insets itself so the typed box and Draft from text can scroll above the keyboard. */}
        <Animated.ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingTop: contentInsetTop }]}
          scrollIndicatorInsets={{ top: contentInsetTop }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <LargeTitle title="Voice Draft" scrollY={scrollY} />
          <View style={styles.sunny}>
            <Sunny size={80} mood={sunnyMood} tappable />
          </View>
          {draft.weekNote ? <Text style={styles.weekNote}>{draft.weekNote}</Text> : null}
          {state.manual ? <Text style={styles.weekNote}>Pick one task for each slot. Tap a title to change it.</Text> : null}
          {showsLineup ? null : (
            <View style={styles.recorder}>
              <Text style={styles.prompt} testID="draft-prompt">
                Try: “{prompt}”
              </Text>
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
              <TypedDraft
                value={typedWeek}
                onChangeText={setTypedWeek}
                onSubmit={() => draft.draftFromText(typedWeek)}
                onFocus={revealTypedWeek}
              />
            </View>
          ) : null}
          {showsLineup ? (
            <View style={styles.lineup}>
              <DraftLineup
                tasks={state.tasks}
                editable={state.phase === "review"}
                suggested={state.manual}
                onRename={draft.renameTask}
                onRemove={draft.removeTask}
              />
            </View>
          ) : null}
        </Animated.ScrollView>
        {/* One primary action at a time: Lock Lineup appears with the lineup it locks. Pinned while
            the player is still talking or typing, it covered "Draft from text" on a short phone. */}
        {/* Talking is the quick way in, not the only one: the same lineup can be picked by hand. A plain
            grey link at the foot of the screen, so the microphone stays the one obvious action. */}
        {state.phase === "idle" && !showsLineup ? (
          <Pressable accessibilityRole="button" onPress={draft.pickOwn} style={styles.skip} testID="draft-skip">
            <Text style={styles.skipLabel}>Skip, I'll pick my own</Text>
          </Pressable>
        ) : null}
        {showsLineup || state.error ? (
          <View style={styles.footer}>
            {state.error ? <Text style={styles.error}>{state.error}</Text> : null}
            {showsLineup ? (
              <Button label="Lock Lineup" onPress={draft.lockLineup} disabled={!draft.canLock} loading={state.phase === "locking"} />
            ) : null}
            {state.phase === "review" ? (
              <Pressable accessibilityRole="button" onPress={draft.redo} style={styles.leave} hitSlop={8}>
                <Text style={styles.redo}>Redo</Text>
              </Pressable>
            ) : null}
            {lockRefused ? (
              <Pressable accessibilityRole="button" style={styles.leave} onPress={() => router.replace("/(tabs)")} hitSlop={8}>
                <Text style={styles.redo}>Go to Roster</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: ROW_HEIGHT + spacing.xxl },
  sunny: { alignItems: "center", paddingBottom: spacing.md },
  weekNote: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: spacing.md, textAlign: "center", ...type.small, color: colors.textMuted },
  recorder: { alignItems: "center" },
  // Room for three lines, so the microphone does not move when the example changes.
  prompt: {
    minHeight: type.body.lineHeight * 3,
    paddingHorizontal: SCREEN_MARGIN,
    paddingBottom: spacing.md,
    textAlign: "center",
    ...type.body,
    color: colors.textMuted,
  },
  skip: { alignSelf: "center", minHeight: MIN_TARGET, justifyContent: "center", paddingHorizontal: SCREEN_MARGIN, marginBottom: spacing.md },
  skipLabel: { ...type.label, fontFamily: fontFamily.regular, color: colors.textMuted },
  transcript: { paddingHorizontal: SCREEN_MARGIN, paddingTop: spacing.lg },
  lineup: { paddingTop: spacing.md },
  // A paper bar with a hairline, so the lineup visibly scrolls under it instead of being sliced.
  footer: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.md, gap: spacing.sm, backgroundColor: colors.background, borderTopWidth: hairline, borderTopColor: colors.divider },
  error: { ...type.body, color: colors.danger },
  leave: { alignSelf: "center", minHeight: MIN_TARGET, justifyContent: "center" },
  redo: { ...type.label, color: colors.accent },
});
