import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as SMS from "expo-sms";
import { useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorLine } from "@/components/join/ErrorLine";
import { PersonRow } from "@/components/join/PersonRow";
import { useContactMatch } from "@/components/join/useContactMatch";
import { PlayByTextRow } from "@/components/keiki/PlayByTextRow";
import { Button, Header, Screen, SectionLabel } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";
import { inviteMessage } from "@/lib/leagueText";
import { shareText } from "@/lib/native/share";
import { colors, font, spacing } from "@/theme";

export { RouteError as ErrorBoundary } from "@/components/social/RouteError";

/** After joining a league: add the friends already on Lineup and text the rest the invite code. */
export default function ContactsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ leagueId?: string; next?: string }>();
  const leagueId = params.leagueId as Id<"leagues"> | undefined;
  const inOnboarding = params.next === "draft";

  const league = useQuery(backend.leagues.get, leagueId ? { leagueId } : "skip");
  const { state, allowAccess } = useContactMatch(leagueId);
  const [declined, setDeclined] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  function leave() {
    if (inOnboarding) router.replace("/draft");
    else router.back();
  }

  // In onboarding there is nothing behind this screen worth returning to, so the
  // system back gesture and Android's back button take the same exit as Skip.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      leave();
      return true;
    });
    return () => subscription.remove();
  });

  const invitees = state.status === "done" ? state.invitees : [];
  const selected = invitees.filter(({ phone }) => !declined.includes(phone));

  async function sendInvites() {
    if (!league) return;
    const message = inviteMessage(league);
    setSending(true);
    try {
      if (await SMS.isAvailableAsync()) await SMS.sendSMSAsync(selected.map(({ phone }) => phone), message);
      else await shareText(message);
    } catch {
      // Whether the composer opens, is cancelled or fails, the player moves on.
    }
    leave();
  }

  function toggle(phone: string) {
    setDeclined((current) => (current.includes(phone) ? current.filter((entry) => entry !== phone) : [...current, phone]));
  }

  const nothingToAdd = state.status === "empty" || (state.status === "done" && state.added.length === 0 && invitees.length === 0);

  return (
    <Screen>
      <Stack.Screen options={{ gestureEnabled: !inOnboarding }} />
      <Header
        title="Add Friends"
        onBack={inOnboarding ? undefined : leave}
        right={
          inOnboarding ? (
            <Pressable onPress={leave} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip">
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          ) : undefined
        }
      />
      <PlayByTextRow />
      <ScrollView style={styles.list}>
        {nothingToAdd ? <Text style={styles.empty}>No contacts to add</Text> : null}
        {state.status === "error" ? (
          <View style={styles.message}>
            <ErrorLine message={state.message} />
          </View>
        ) : null}
        {state.status === "done" && state.added.length > 0 ? (
          <>
            <SectionLabel left="Added to your league" />
            {state.added.map(({ userId, name }) => (
              <PersonRow key={userId} name={name} />
            ))}
          </>
        ) : null}
        {invitees.length > 0 ? (
          <>
            <SectionLabel left="Not on Lineup yet" />
            {invitees.map(({ phone, name }) => (
              <PersonRow
                key={phone}
                name={name}
                detail={name === phone ? undefined : phone}
                selected={!declined.includes(phone)}
                onToggle={() => toggle(phone)}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        {state.status === "idle" || state.status === "loading" || state.status === "error" ? (
          <Button label="Allow access to contacts" onPress={allowAccess} loading={state.status === "loading"} disabled={!leagueId} />
        ) : selected.length > 0 ? (
          <Button label="Text invite" onPress={sendInvites} loading={sending} disabled={!league} />
        ) : (
          <Button label="Continue" onPress={leave} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  skip: { fontSize: font.body, fontWeight: "700", color: colors.accent },
  empty: { padding: spacing.lg, fontSize: font.body, color: colors.textMuted },
  message: { padding: spacing.lg },
  footer: { padding: spacing.lg },
});
