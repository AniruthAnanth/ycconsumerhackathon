import { useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressScale } from "@/components/motion";
import { Button, Header, Icon, Screen, TextField } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, hairline, layout, radius, spacing, type } from "@/theme";

import { ErrorLine } from "./ErrorLine";
import { FormBody } from "./FormBody";
import { DEFAULT_MODE, JOIN_MODES, type JoinMode, modeOf, stakeLine } from "./joinModes";
import { StakePicker } from "./StakePicker";
import type { Stake } from "./stakes";
import { StepContext } from "./StepContext";
import { useJoinLeague } from "./useJoinLeague";

/**
 * One question, "How do you want to play?", instead of four stacked sections: pick a mode from the
 * menu, answer what that mode needs (a stake, a code), and take the one button at the bottom.
 * 1v1 and Create hand over to their own screens; Quick match and a code join here.
 */
export function JoinScreen() {
  const router = useRouter();
  const joining = useJoinLeague();
  const { join, busy, failure, clearFailure } = joining;
  const quickMatch = useMutation(backend.leagues.quickMatch);
  const joinByCode = useMutation(backend.leagues.joinByCode);
  const { me } = useCurrentLeague();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  // Only on the way into a first league (or its replay) is this a step of something larger.
  const firstLeague = replay === "1" || me?.leagues.length === 0;
  const [mode, setMode] = useState<JoinMode>(DEFAULT_MODE);
  const [open, setOpen] = useState(false);
  const [stakeUsd, setStakeUsd] = useState<Stake>(0);
  const [code, setCode] = useState("");
  const selected = modeOf(mode);
  const inviteCode = code.trim();

  function pick(next: JoinMode) {
    setMode(next);
    setOpen(false);
    clearFailure();
  }

  function go() {
    if (mode === "versus") return router.push("/versus/new");
    if (mode === "create") return router.push("/create-league");
    if (mode === "quickMatch") return join("quickMatch", () => quickMatch({ stakeUsd }));
    if (inviteCode) return join("inviteCode", () => joinByCode({ inviteCode }));
  }

  return (
    <Screen>
      <Header title="Join a League" onBack={router.canGoBack() ? router.back : undefined} />
      {firstLeague ? <StepContext step={2} label="Join or start a league" /> : null}
      <FormBody>
        <View style={styles.body}>
          <Text style={styles.question}>How do you want to play?</Text>
          <PressScale
            style={[styles.selector, open && styles.selectorOpen]}
            onPress={() => setOpen(!open)}
            disabled={busy}
            testID="join-mode-selector"
            accessibilityRole="button"
            accessibilityLabel={`How do you want to play? ${selected.label}`}
            accessibilityState={{ expanded: open, disabled: busy }}
          >
            <Text style={styles.selectorLabel}>{selected.label}</Text>
            <Icon name={open ? "chevron-up" : "chevron-down"} color={colors.accent} />
          </PressScale>
          {open ? (
            <View style={styles.menu} accessibilityRole="radiogroup">
              {JOIN_MODES.map((option, index) => (
                <PressScale
                  key={option.key}
                  style={[styles.option, index > 0 && styles.optionDivider, option.key === mode && styles.optionOn]}
                  onPress={() => pick(option.key)}
                  testID={`join-mode-${option.key}`}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityHint={option.description}
                  accessibilityState={{ checked: option.key === mode }}
                >
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.description}>{option.description}</Text>
                  </View>
                  {option.key === mode ? <Icon name="checkmark" color={colors.accent} /> : null}
                </PressScale>
              ))}
            </View>
          ) : (
            <Text style={styles.description}>{selected.description}</Text>
          )}
          {!open && mode === "quickMatch" ? (
            <View style={styles.detail}>
              <StakePicker value={stakeUsd} onChange={setStakeUsd} disabled={busy} />
              {stakeLine(stakeUsd) ? <Text style={styles.description}>{stakeLine(stakeUsd)}</Text> : null}
            </View>
          ) : null}
          {!open && mode === "code" ? (
            <TextField
              label="Code"
              value={code}
              onChangeText={(text) => {
                // An error is about the code that was sent, not the one being typed now.
                clearFailure();
                setCode(text);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={go}
            />
          ) : null}
          {failure ? <ErrorLine message={failure.message} /> : null}
        </View>
        <View style={styles.footer}>
          <Button label={selected.action} onPress={go} loading={busy} disabled={mode === "code" && !inviteCode} />
        </View>
      </FormBody>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: layout.margin, paddingTop: spacing.lg, gap: spacing.md },
  question: { ...type.heading, color: colors.text },
  selector: {
    minHeight: layout.control,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  selectorOpen: { borderColor: colors.accent },
  selectorLabel: { ...type.label, color: colors.text },
  menu: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, overflow: "hidden" },
  option: { minHeight: layout.rowMin, flexDirection: "row", alignItems: "center", gap: layout.columnGap, padding: spacing.lg },
  optionDivider: { borderTopWidth: hairline, borderTopColor: colors.divider },
  optionOn: { backgroundColor: colors.accentTint },
  optionText: { flex: 1, gap: spacing.xs },
  optionLabel: { ...type.label, color: colors.text },
  description: { ...type.small, color: colors.textMuted },
  detail: { gap: spacing.sm },
  // The one action sits at the foot of the page; FormBody lifts it above the keyboard.
  footer: { flex: 1, justifyContent: "flex-end", padding: layout.margin },
});
