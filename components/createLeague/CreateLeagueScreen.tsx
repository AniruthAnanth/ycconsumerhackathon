import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorLine } from "@/components/join/ErrorLine";
import { useJoinLeague } from "@/components/join/useJoinLeague";
import { ProgressFill } from "@/components/motion";
import { Button, Header, OutlinedPillButton, Screen } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, hairline, layout, spacing, type } from "@/theme";

import { KindStep, NameStep, ReviewStep, SeasonStep, StakeStep } from "./Steps";
import { StepSlide } from "./StepSlide";
import { blockerOf, defaultDraft, progressOf, RECOMMENDED_SETTINGS, stepAfter, stepBefore, type Draft, type Step } from "./wizard";

/**
 * Create a League as a walkthrough: one question per step, each already answered with the
 * recommended choice, so Next alone reaches Create. Creating goes on to Add Friends like every
 * other way into a league (useJoinLeague).
 */
export function CreateLeagueScreen() {
  const router = useRouter();
  const { me } = useCurrentLeague();
  const createLeague = useMutation(api.leagues.create);
  const { join, busy, failure } = useJoinLeague();
  const [draft, setDraft] = useState<Draft>(() => defaultDraft(me?.name));
  const [{ step, forward }, setPlace] = useState<{ step: Step; forward: boolean | null }>({ step: "name", forward: null });
  const change = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const progress = progressOf(step);
  const blocker = blockerOf(step, draft);
  // A versus is one friend for one week, with no name, season or format to ask about: its own screen takes over.
  const openVersus = () => router.push("/versus/new");

  function back() {
    const previous = stepBefore(step);
    if (previous) setPlace({ step: previous, forward: false });
    else if (router.canGoBack()) router.back();
    else router.replace("/join");
  }

  function next() {
    if (blocker) return;
    if (step === "kind" && draft.kind === "versus") return openVersus();
    setPlace({ step: stepAfter(step), forward: true });
  }

  /** The fast path: the recommended season, and straight to Review with the answers given so far. */
  function takeRecommended() {
    if (draft.name.trim().length === 0) return;
    if (draft.kind === "versus") return openVersus();
    change({ settings: RECOMMENDED_SETTINGS });
    // A custom buy-in still without an amount is finished on its own step first.
    setPlace({ step: draft.stakeUsd === null ? "stake" : "review", forward: true });
  }

  function create() {
    const { stakeUsd } = draft;
    if (blocker || stakeUsd === null) return;
    // The settings always go with it: left out, the server would pick a single round robin.
    join("create", () => createLeague({ name: draft.name.trim(), stakeUsd, visibility: "private", settings: draft.settings }));
  }

  const steps = { draft, change, disabled: busy };
  return (
    <Screen>
      <Header title="Create a League" onBack={busy ? undefined : back} />
      <View style={styles.progress}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>{progress.label}</Text>
          {step === "name" || step === "kind" || step === "stake" ? (
            <Pressable
              style={styles.fastPath}
              onPress={takeRecommended}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Use recommended"
              accessibilityHint="Skips to the review with the recommended setup"
            >
              <Text style={styles.fastPathLabel}>Use recommended</Text>
            </Pressable>
          ) : null}
        </View>
        <ProgressFill ratio={progress.ratio} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <StepSlide step={step} forward={forward}>
            {step === "name" ? <NameStep {...steps} /> : null}
            {step === "kind" ? <KindStep {...steps} /> : null}
            {step === "stake" ? <StakeStep {...steps} /> : null}
            {step === "season" ? <SeasonStep {...steps} onUseRecommended={takeRecommended} /> : null}
            {step === "review" ? <ReviewStep draft={draft} /> : null}
          </StepSlide>
        </ScrollView>
        <View style={styles.footer}>
          {blocker ? <Text style={styles.blocker}>{blocker}</Text> : null}
          {failure ? <ErrorLine message={failure.message} /> : null}
          <View style={styles.actions}>
            <OutlinedPillButton label="Back" onPress={back} disabled={busy} />
            {step === "review" ? (
              <Button label="Create League" onPress={create} loading={busy} disabled={blocker !== null} style={styles.flex} />
            ) : step === "season" ? (
              // "Use recommended" is this step's one filled button; Next keeps whatever Advanced has picked.
              <OutlinedPillButton label="Next" onPress={next} disabled={blocker !== null} style={styles.flex} />
            ) : (
              <Button label="Next" onPress={next} disabled={blocker !== null} style={styles.flex} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progress: { paddingHorizontal: layout.margin, paddingBottom: spacing.sm },
  progressRow: { minHeight: layout.rowMin, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel: { ...type.label, color: colors.textMuted },
  fastPath: { minHeight: layout.rowMin, justifyContent: "center" },
  fastPathLabel: { ...type.label, color: colors.accent },
  // The step slides in from past the edge of the page; nothing of it shows there.
  body: { flexGrow: 1, overflow: "hidden" },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: layout.margin,
    paddingVertical: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  blocker: { ...type.small, color: colors.textMuted },
  actions: { flexDirection: "row", alignItems: "center", gap: layout.columnGap },
});
