import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { resetCoachMarks } from "@/components/coach";
import { usePlayByText } from "@/components/keiki/usePlayByText";
import { SilentBoundary } from "@/components/notifications/SilentBoundary";
import { usePushSwitch } from "@/components/notifications/usePushSwitch";
import { confirmAction, notify } from "@/components/social/notify";
import { Header, LargeTitle, Screen, useCollapsingHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { setAppPref, useAppPrefs } from "@/lib/appPrefs";
import { useCurrentLeague } from "@/lib/currentLeague";
import { errorMessage } from "@/lib/errorMessage";
import { spacing } from "@/theme";

import { AccountSection } from "./AccountSection";
import { LeaguesSection } from "./LeaguesSection";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

const DELETE_CONSEQUENCES =
  "This deletes your name, phone number, league memberships, lineups and proofs. Your phone number becomes free to sign up again. This can't be undone.";

/**
 * Settings, opened from the gear in the tabs' header: an iOS-style inset-grouped list of the
 * account, notifications, this device's app preferences, leagues, help, the demo controls and
 * the danger zone. Each switch reuses the module that owns it; nothing here holds its own rules.
 */
export function SettingsScreen() {
  const router = useRouter();
  const { me } = useCurrentLeague();
  const { scrollY, onScroll, contentInsetTop } = useCollapsingHeader();
  const push = usePushSwitch();
  const playByText = usePlayByText();
  const deleteAccount = useMutation(api.users.deleteAccount);
  const { signOut } = useAuthActions();
  const app = useAppPrefs();

  // AuthGate signs the device straight back in as a fresh anonymous account, and the tabs send
  // a player who has not onboarded to the intro, so leaving lands where a new install starts.
  async function leave() {
    router.replace("/how-it-works");
    await signOut();
  }

  function confirmDelete() {
    confirmAction({
      title: "Delete your account?",
      message: DELETE_CONSEQUENCES,
      confirmLabel: "Delete account",
      onConfirm: () => {
        deleteAccount({})
          .then(leave)
          .catch((failure) => notify("Couldn't delete your account", errorMessage(failure)));
      },
    });
  }

  return (
    <Screen edges={["bottom"]}>
      <Header title="Settings" onBack={router.back} scrollY={scrollY} />
      <Animated.ScrollView
        contentContainerStyle={[styles.content, { paddingTop: contentInsetTop }]}
        scrollIndicatorInsets={{ top: contentInsetTop }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        testID="settings-screen"
      >
        <LargeTitle title="Settings" scrollY={scrollY} />
        {me ? <AccountSection me={me} /> : null}

        <SettingsGroup title="Notifications">
          <SettingsRow
            title="Push notifications"
            subtitle={push?.copy ?? "Available in the iPhone app."}
            switchValue={push?.value ?? false}
            onSwitch={(on) => void push?.onValueChange(on)}
            disabled={!push}
            testID="settings-push"
          />
          <SettingsRow
            title="Play by text"
            subtitle={playByText.copy}
            switchValue={playByText.value}
            onSwitch={(on) => void playByText.onValueChange(on)}
            disabled={!playByText.ready}
            testID="settings-play-by-text"
          />
          <SilentBoundary>
            <NudgesRow />
          </SilentBoundary>
        </SettingsGroup>

        <SettingsGroup title="App" footer="These apply to this phone only.">
          <SettingsRow title="Haptics" switchValue={app.haptics} onSwitch={(haptics) => setAppPref({ haptics })} testID="settings-haptics" />
          <SettingsRow
            title="Reduce motion"
            subtitle={app.reduceMotion === "on" ? "Always on in Lineup." : "Follows your system setting."}
            switchValue={app.reduceMotion === "on"}
            onSwitch={(on) => setAppPref({ reduceMotion: on ? "on" : "system" })}
            testID="settings-reduce-motion"
          />
        </SettingsGroup>

        {me && me.leagues.length > 0 ? <LeaguesSection leagues={me.leagues} /> : null}

        <SettingsGroup title="Help">
          <SettingsRow
            title="How Lineup works"
            onPress={() => router.push({ pathname: "/how-it-works", params: { source: "profile" } })}
            testID="settings-how-it-works"
          />
          <SettingsRow
            title="Reset tips"
            subtitle="Show the first-run tips again."
            onPress={() => void resetCoachMarks().then(() => notify("Tips reset", "You'll see them again as you go."))}
            testID="settings-reset-tips"
          />
        </SettingsGroup>

        <SettingsGroup title="Demo">
          <SettingsRow title="Demo controls" onPress={() => router.push("/demo")} testID="settings-demo" />
        </SettingsGroup>

        <SettingsGroup title="Danger zone">
          <SettingsRow title="Sign out" destructive onPress={() => void leave()} testID="settings-sign-out" />
          <SettingsRow title="Delete account" destructive onPress={confirmDelete} testID="settings-delete-account" />
        </SettingsGroup>
        <View style={styles.end} />
      </Animated.ScrollView>
    </Screen>
  );
}

/**
 * The Nudges switch (users.preferences). Behind a SilentBoundary in the screen, so a backend that
 * has not caught up yet hides this one row instead of the whole screen.
 */
function NudgesRow() {
  const preferences = useQuery(api.users.preferences);
  const setNudges = useMutation(api.users.setNudges);
  return (
    <SettingsRow
      title="Nudges"
      subtitle="Check-in reminders when a slot is still open."
      switchValue={preferences?.nudgesOn ?? true}
      onSwitch={(enabled) => void setNudges({ enabled })}
      disabled={!preferences}
      testID="settings-nudges"
    />
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  end: { height: spacing.xxl },
});
