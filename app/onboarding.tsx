import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ErrorLine } from "@/components/join/ErrorLine";
import { errorMessage } from "@/components/join/errorMessage";
import { FormBody } from "@/components/join/FormBody";
import { Button, Header, Screen, TextField } from "@/components/ui";
import { backend } from "@/lib/backend";
import { phoneHint, toE164 } from "@/lib/phone";
import { spacing } from "@/theme";

export { RouteError as ErrorBoundary } from "@/components/social/RouteError";

/** The first screen of a new player: name and phone, then straight on to picking a league. */
export default function OnboardingScreen() {
  const router = useRouter();
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
    setSaving(true);
    setError(null);
    try {
      await createUser({ name: trimmedName, phone: e164 });
      router.replace("/join");
    } catch (failure) {
      setError(errorMessage(failure));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Header title="Lineup" />
      <FormBody>
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
        </View>
        <View style={styles.action}>
          <Button label="Join" onPress={submit} loading={saving} disabled={!trimmedName || !e164} />
        </View>
      </FormBody>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { padding: spacing.lg, gap: spacing.lg },
  // The action sits at the foot of the page; FormBody lifts it above the keyboard.
  action: { flex: 1, justifyContent: "flex-end", padding: spacing.lg },
});
