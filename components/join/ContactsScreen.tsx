import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as SMS from "expo-sms";
import { useEffect, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { InviteButton, useInviteMessage } from "@/components/invite";
import { ErrorLine } from "@/components/join/ErrorLine";
import { StepContext } from "@/components/join/StepContext";
import { PersonRow } from "@/components/join/PersonRow";
import { useContactMatch } from "@/components/join/useContactMatch";
import { Button, cardStyle, Header, OutlinedPillButton, Screen, SectionLabel } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { inviteMessage } from "@/lib/leagueText";
import { shareText } from "@/lib/native/share";
import { colors, font, fontFamily, layout, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

/**
 * After joining or creating a league: the league is ready, here is its code, now bring friends.
 * Sharing the link is the main way; contacts and Skip are there for the rest. Play by text is
 * set up from the League tab, not here, so nothing competes with the invite.
 */
export function ContactsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ leagueId?: string; next?: string; created?: string }>();
  const leagueId = params.leagueId as Id<"leagues"> | undefined;
  // useJoinLeague sends `next` when this step follows joining a league; Add
  // Friends on the League tab sends none and is an ordinary pushed screen.
  const justJoined = params.next !== undefined;

  const league = useQuery(backend.leagues.get, leagueId ? { leagueId } : "skip");
  const { me } = useCurrentLeague();
  const { state, allowAccess } = useContactMatch(leagueId);
  // Nobody is ticked to begin with: the player picks who gets a text.
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
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
  const selected = invitees.filter(({ phone }) => picked.includes(phone));

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
    setPicked((current) => (current.includes(phone) ? current.filter((entry) => entry !== phone) : [...current, phone]));
  }

  /** The web copies the code; elsewhere the share sheet, which has Copy, carries it. */
  async function copyCode() {
    if (!league) return;
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(league.inviteCode);
        setCopied(true);
      } catch {
        // A browser that refuses the clipboard still shows the code to read out.
      }
      return;
    }
    await shareText(inviteMessage(league));
  }

  const nothingToAdd = state.status === "empty" || (state.status === "done" && state.added.length === 0 && invitees.length === 0);
  const asking = state.status === "idle" || state.status === "loading" || state.status === "error";

  return (
    <Screen>
      <Stack.Screen options={{ gestureEnabled: !justJoined }} />
      <Header title="Add Friends" onBack={justJoined ? undefined : leave} />
      {justJoined && (me?.leagues.length ?? 0) <= 1 ? <StepContext step={3} /> : null}
      <ScrollView style={styles.list}>
        {league ? (
          <View style={styles.hero}>
            <Text style={styles.ready} accessibilityRole="header">
              {!justJoined ? league.name : params.created ? `${league.name} is ready` : `You're in ${league.name}`}
            </Text>
            <Text style={styles.line}>Friends join with this code, or with the link you share.</Text>
            <Pressable
              style={styles.codeCard}
              onPress={copyCode}
              accessibilityRole="button"
              accessibilityLabel={`Invite code ${league.inviteCode}`}
              accessibilityHint={Platform.OS === "web" ? "Copies the code" : "Opens the share sheet to copy or send the code"}
            >
              <Text style={styles.codeLabel}>INVITE CODE</Text>
              <Text style={[styles.code, tabular]} selectable>
                {league.inviteCode}
              </Text>
              <Text style={styles.copy}>{copied ? "Copied" : Platform.OS === "web" ? "Tap to copy" : "Tap to copy or send"}</Text>
            </Pressable>
          </View>
        ) : null}
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
            {invitees.map(({ phone, name, otherPhones }) => (
              <PersonRow
                key={phone}
                name={name}
                detail={[name === phone ? null : phone, ...otherPhones].filter(Boolean).join(" · ") || undefined}
                selected={picked.includes(phone)}
                onToggle={() => toggle(phone)}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        {/* Sharing the link is the one filled button, until contacts are ticked: then texting them is. */}
        {leagueId ? <InviteButton leagueId={leagueId} label="Share invite link" variant={selected.length > 0 ? "outlined" : "primary"} /> : null}
        {asking ? (
          <OutlinedPillButton
            label={state.status === "loading" ? "Reading contacts…" : "Allow access to contacts"}
            accessibilityLabel="Allow access to contacts"
            onPress={allowAccess}
            disabled={!leagueId || state.status === "loading"}
          />
        ) : selected.length > 0 ? (
          <Button label="Text invite" onPress={sendInvites} loading={sending} disabled={!league} />
        ) : null}
        {/* The quiet way on for a player who adds nobody now; friends can be invited later from the League tab. */}
        {justJoined || !asking ? (
          <Pressable style={styles.textLink} onPress={leave} accessibilityRole="button" accessibilityLabel={asking || selected.length > 0 ? "Skip" : "Continue"}>
            <Text style={styles.textLinkLabel}>{asking || selected.length > 0 ? "Skip" : "Continue"}</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  empty: { padding: SCREEN_MARGIN, fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted },
  message: { padding: SCREEN_MARGIN },
  footer: { padding: SCREEN_MARGIN, gap: spacing.sm },
  hero: { paddingHorizontal: layout.margin, paddingTop: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm },
  ready: { ...type.title, color: colors.text },
  line: { ...type.body, color: colors.textMuted },
  codeCard: {
    ...cardStyle,
    marginTop: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.xl,
  },
  codeLabel: { ...type.caption, color: colors.textMuted, letterSpacing: 0.6 },
  code: { ...type.display, color: colors.text, letterSpacing: 4 },
  copy: { ...type.small, color: colors.accent },
  textLink: { minHeight: layout.rowMin, alignItems: "center", justifyContent: "center" },
  textLinkLabel: { ...type.label, color: colors.accent },
});
