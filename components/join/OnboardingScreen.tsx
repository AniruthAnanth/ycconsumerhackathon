import { useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Sunny } from "@/components/art";
import { ErrorLine } from "@/components/join/ErrorLine";
import { errorMessage } from "@/components/join/errorMessage";
import { FormBody } from "@/components/join/FormBody";
import { Button, Header, Screen, TextField } from "@/components/ui";
import { backend } from "@/lib/backend";
import { phoneHint, toE164 } from "@/lib/phone";
import { colors, SCREEN_MARGIN, spacing, type } from "@/theme";

import { StepContext } from "./StepContext";

/** The first screen of a new player: name and phone, then straight on to picking a league. */
export function OnboardingScreen() {
  const router = useRouter();
  // Set when a challenge link brought a new player here: accept it once they have a name.
  const { versusCode, replay } = useLocalSearchParams<{ versusCode?: string; replay?: string }>();
  // Demo controls' Replay onboarding shows this step on stage without changing the signed-in account.
  const replaying = replay === "1";
  const createUser = useMutation(backend.users.createUser);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const e164 = toE164(phone);
  const hint = phoneHint(phone);

  async function submit() {
    if (!trimmedName || !e164) return;
    if (replaying) return router.replace({ pathname: "/join", params: { replay: "1" } });
    setSaving(true);
    setError(null);
    try {
      await createUser({ name: trimmedName, phone: e164 });
      router.replace(versusCode ? { pathname: "/versus/join", params: { code: versusCode } } : "/join");
    } catch (failure) {
      setError(errorMessage(failure));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Header title="Lineup" />
      <StepContext step={1} label="About you" />
      <FormBody>
        <View style={styles.sunny}>
          <Sunny size={108} tappable />
        </View>
        <View style={styles.fields}>
          <TextField
            label="Name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            editable={!saving}
          />
          <TextField
            label="Phone"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              setError(null);
            }}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="done"
            editable={!saving}
            onSubmitEditing={submit}
          />
          {hint ? <ErrorLine message={hint} /> : null}
          {error ? <ErrorLine message={error} /> : null}
          {replaying ? <Text style={styles.note}>Replay: Join goes on to the next step without changing your account.</Text> : null}
        </View>
        <View style={styles.action}>
          <Button label="Join" onPress={submit} loading={saving} disabled={!trimmedName || !e164} />
        </View>
      </FormBody>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sunny: { alignItems: "center", paddingTop: spacing.xl },
  note: { ...type.small, color: colors.textMuted },
  fields: { padding: SCREEN_MARGIN, gap: spacing.lg },
  // The action sits at the foot of the page; FormBody lifts it above the keyboard.
  action: { flex: 1, justifyContent: "flex-end", padding: SCREEN_MARGIN },
});
