import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { InviteButton, RecruiterCard } from "@/components/invite";
import { Header, Screen } from "@/components/ui";
import { useCurrentLeague } from "@/lib/currentLeague";
import { spacing } from "@/theme";

export { RouteError as ErrorBoundary } from "@/components/social/RouteError";

/** The invite hub: the caller's Recruiter card and one button to share the current league. */
export default function InviteHubScreen() {
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
