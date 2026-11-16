import { useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Artwork } from "@/components/art";
import { ErrorLine } from "@/components/join/ErrorLine";
import { errorMessage } from "@/components/join/errorMessage";
import { FormBody } from "@/components/join/FormBody";
import { BackBar } from "@/components/join/BackBar";
import { Button, Screen, TextField } from "@/components/ui";
import { backend } from "@/lib/backend";
import { leaveScreen } from "@/lib/leaveScreen";
import { haptics } from "@/lib/native/haptics";
import { formatPhoneInput, phoneHint, toE164 } from "@/lib/phone";
import { colors, SCREEN_MARGIN, spacing, type } from "@/theme";

import { signupDraft } from "./signupDraft";
import { StepContext } from "./StepContext";

/** The first screen of a new player: name and phone, then straight on to picking a league. */
export function OnboardingScreen() {
  const router = useRouter();
  // Set when a challenge link brought a new player here: accept it once they have a name.
  const { versusCode, replay } = useLocalSearchParams<{ versusCode?: string; replay?: string }>();
  // Demo controls' Replay onboarding shows this step on stage without changing the signed-in account.
  const replaying = replay === "1";
  const createUser = useMutation(backend.users.createUser);
  const [name, setName] = useState(signupDraft.name);
  const [phone, setPhone] = useState(signupDraft.phone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The number pad lifts Continue onto the caption under the phone field, so it shows only while the pad is down.
  const [typingPhone, setTypingPhone] = useState(false);

  const trimmedName = name.trim();
  const e164 = toE164(phone);
  const hint = phoneHint(phone);

  async function submit() {
    // Replay writes nothing, so it goes on whatever the fields hold.
    // Pushed, not replaced: Back on Join returns here with the name and phone still typed in.
    if (replaying) return router.push({ pathname: "/join", params: { replay: "1" } });
    if (!trimmedName || !e164) return;
    setSaving(true);
    setError(null);
    try {
      await createUser({ name: trimmedName, phone: e164 });
      haptics.success();
      setSaving(false);
      if (versusCode) router.replace({ pathname: "/versus/join", params: { code: versusCode } });
      else router.push("/join");
    } catch (failure) {
      setError(errorMessage(failure));
      setSaving(false);
    }
  }

  return (
    <Screen>
      {/* Back to the intro's last card; a deep link with no history starts the intro over. */}
      <BackBar onBack={() => leaveScreen("/how-it-works")} />
      <StepContext step={1} />
      <FormBody footer={<Button label="Continue" onPress={submit} loading={saving} disabled={!replaying && (!trimmedName || !e164)} />}>
        <Text style={styles.title} accessibilityRole="header">
          What's your name?
        </Text>
        <View style={styles.sunny}>
          <Artwork name="sunny" size={108} />
        </View>
        <View style={styles.fields}>
          <TextField
            label="Name"
            placeholder="Alex Rivera"
            value={name}
            onChangeText={(text) => {
              setName(text);
              signupDraft.name = text;
              setError(null);
            }}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            editable={!saving}
          />
          <View style={styles.phone}>
            <TextField
              label="Phone"
              value={phone}
              onChangeText={(text) => {
                const formatted = formatPhoneInput(text, phone);
                setPhone(formatted);
                signupDraft.phone = formatted;
                setError(null);
              }}
              prefix="+1"
              placeholder="(650) 555-7733"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              editable={!saving}
              onFocus={() => setTypingPhone(true)}
              onBlur={() => setTypingPhone(false)}
            />
            {typingPhone ? null : <Text style={styles.note}>For your league's texts. Never shown.</Text>}
          </View>
          {hint ? <ErrorLine message={hint} /> : null}
          {error ? <ErrorLine message={error} /> : null}
          {replaying ? <Text style={styles.note}>Replay: Continue goes on to the next step without changing your account.</Text> : null}
        </View>
      </FormBody>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title, color: colors.text, paddingHorizontal: SCREEN_MARGIN, paddingTop: spacing.sm },
  sunny: { alignItems: "center", paddingTop: spacing.xl },
  note: { ...type.small, color: colors.textMuted },
  fields: { padding: SCREEN_MARGIN, gap: spacing.lg },
  // The footnote belongs to the Phone field, so it sits at the field's own label gap.
  phone: { gap: spacing.xs },
});
