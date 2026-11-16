import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ErrorLine } from "@/components/join/ErrorLine";
import { FormBody } from "@/components/join/FormBody";
import { Button, Header, OutlinedPillButton, Screen, TextField } from "@/components/ui";
import { formatPhoneInput, phoneHint, toE164 } from "@/lib/phone";
import { leaveScreen } from "@/components/social/leave";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing } from "@/theme";

import { inviteDetailLine } from "./inviteRoute";
import { useAcceptInvite } from "./useAcceptInvite";

/** Where a friend's invite link opens: who invited them to what, then one tap to join. */
export function InviteScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { me, preview, join, open, saving, error, clearError } = useAcceptInvite(token ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  if (me === undefined || preview === undefined) {
    return (
      <Screen>
        <Header title="Invite" onBack={leaveScreen} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.textMuted} />
        </View>
      </Screen>
    );
  }

  if (preview === null) {
    return (
      <Screen>
        <Header title="Invite" onBack={leaveScreen} />
        <View style={styles.center}>
          <Text style={styles.muted}>This invite link is not valid</Text>
          <OutlinedPillButton label="Join with a code" onPress={() => router.replace({ pathname: "/join", params: { mode: "code" } })} />
        </View>
      </Screen>
    );
  }

  const needsProfile = !me?.onboarded;
  const trimmedName = name.trim();
  const e164 = toE164(phone);
  const hint = phoneHint(phone);

  return (
    <Screen>
      <Header title="Invite" onBack={leaveScreen} />
      <FormBody>
        <View style={styles.hero}>
          <Text style={styles.kicker}>{preview.isSelf ? "This is your own invite" : `${preview.inviterName} invited you`}</Text>
          <Text style={styles.league}>{preview.leagueName}</Text>
          <Text style={styles.muted}>{inviteDetailLine(preview)}</Text>
        </View>
        {needsProfile && !preview.isSelf ? (
          <View style={styles.fields}>
            <TextField
              label="Name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                clearError();
              }}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              editable={!saving}
            />
            <TextField
              label="Phone"
              value={phone}
              onChangeText={(text) => {
                setPhone(formatPhoneInput(text, phone));
                clearError();
              }}
              prefix="+1"
              placeholder="(650) 555-7733"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              editable={!saving}
            />
            {hint ? <ErrorLine message={hint} /> : null}
          </View>
        ) : null}
        <View style={styles.action}>
          {error ? <ErrorLine message={error} /> : null}
          {preview.isSelf || preview.alreadyMember ? (
            <Button label="Open" onPress={open} />
          ) : needsProfile ? (
            <Button
              label={`Join ${preview.leagueName}`}
              onPress={() => e164 && join({ name: trimmedName, phone: e164 })}
              loading={saving}
              disabled={!trimmedName || !e164}
            />
          ) : (
            <Button label="Join" onPress={() => join()} loading={saving} />
          )}
        </View>
      </FormBody>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: SCREEN_MARGIN },
  hero: { alignItems: "center", gap: spacing.sm, paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.xl },
  kicker: { fontSize: font.label, fontFamily: fontFamily.bold, letterSpacing: 0.5, color: colors.accent, textTransform: "uppercase" },
  league: { fontSize: font.total, fontFamily: fontFamily.bold, color: colors.text, textAlign: "center" },
  muted: { fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted, textAlign: "center" },
  fields: { padding: SCREEN_MARGIN, gap: spacing.lg },
  action: { flex: 1, justifyContent: "flex-end", gap: spacing.sm, paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.lg },
});
