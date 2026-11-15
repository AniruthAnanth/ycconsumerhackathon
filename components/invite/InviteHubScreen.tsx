import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Header, Screen } from "@/components/ui";
import { useCurrentLeague } from "@/lib/currentLeague";
import { spacing } from "@/theme";

import { InviteButton } from "./InviteButton";
import { RecruiterCard } from "./RecruiterCard";

/** The invite hub: the caller's Recruiter card and one button to share the current league. */
export function InviteHubScreen() {
  const router = useRouter();
  const { leagueId } = useCurrentLeague();
  return (
    <Screen scroll>
      <Header title="Invite friends" onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <RecruiterCard />
      <View style={styles.action}>
        <InviteButton leagueId={leagueId} variant="primary" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { padding: spacing.lg },
});
