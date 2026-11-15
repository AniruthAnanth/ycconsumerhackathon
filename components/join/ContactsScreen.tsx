import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as SMS from "expo-sms";
import { useEffect, useState } from "react";
import { BackHandler, ScrollView, StyleSheet, Text, View } from "react-native";

import { InviteButton, useInviteMessage } from "@/components/invite";
import { ErrorLine } from "@/components/join/ErrorLine";
import { PersonRow } from "@/components/join/PersonRow";
import { useContactMatch } from "@/components/join/useContactMatch";
import { PlayByTextRow } from "@/components/keiki/PlayByTextRow";
import { Button, Header, OutlinedPillButton, Screen, SectionLabel } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";
import { inviteMessage } from "@/lib/leagueText";
import { shareText } from "@/lib/native/share";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing } from "@/theme";

/** After joining a league: add the friends already on Lineup and text the rest the invite code. */
export function ContactsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ leagueId?: string; next?: string }>();
  const leagueId = params.leagueId as Id<"leagues"> | undefined;
  // useJoinLeague sends `next` when this step follows joining a league; Add
  // Friends on the League tab sends none and is an ordinary pushed screen.
  const justJoined = params.next !== undefined;

  const league = useQuery(backend.leagues.get, leagueId ? { leagueId } : "skip");
  const { state, allowAccess } = useContactMatch(leagueId);
  const [declined, setDeclined] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const linkMessage = useInviteMessage();

  function leave() {
    if (!justJoined) return router.back();
    // Join, and League Settings when the league was created there, are still in
    // the stack and must not be what Back returns to. Dismissing to the first
    // screen leaves the tabs for a player who came from them and Join for a new
    // player, whose tabs were replaced by onboarding. Replacing that screen
    // gives both a fresh set of tabs, which opens on Roster whichever tab the
    // player opened the league switcher from.
    if (router.canDismiss()) router.dismissAll();
    router.replace("/");
    if (params.next === "draft") router.push("/draft");
  }

  // After joining, what is behind this screen is the form the player has just
  // completed, so the system back gesture and Android's back button take the
  // same exit as Skip.
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
    setSending(true);
    // The short link opens the app straight to this league; the bare code is the fallback if the link cannot be made.
    const message = await linkMessage(league._id).catch(() => inviteMessage(league));
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
  const asking = state.status === "idle" || state.status === "loading" || state.status === "error";

  return (
    <Screen>
      <Stack.Screen options={{ gestureEnabled: !justJoined }} />
      <Header title="Add Friends" onBack={justJoined ? undefined : leave} />
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
        {leagueId ? <InviteButton leagueId={leagueId} label="Share invite link" /> : null}
        {asking ? (
          <Button label="Allow access to contacts" onPress={allowAccess} loading={state.status === "loading"} disabled={!leagueId} />
        ) : selected.length > 0 ? (
          <Button label="Text invite" onPress={sendInvites} loading={sending} disabled={!league} />
        ) : (
          <Button label="Continue" onPress={leave} />
        )}
        {/* The way on for a player who adds nobody. It was a text link in the header, the hardest control here to find; Continue already is that way on, so it needs none. */}
        {justJoined && (asking || selected.length > 0) ? <OutlinedPillButton label="Skip" onPress={leave} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  empty: { padding: SCREEN_MARGIN, fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted },
  message: { padding: SCREEN_MARGIN },
  footer: { padding: SCREEN_MARGIN, gap: spacing.sm },
});
