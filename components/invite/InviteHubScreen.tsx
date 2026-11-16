import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { Header, LargeTitle, Screen, useCollapsingHeader } from "@/components/ui";
import { useCurrentLeague } from "@/lib/currentLeague";
import { SCREEN_MARGIN, spacing } from "@/theme";

import { InviteButton } from "./InviteButton";
import { RecruiterCard } from "./RecruiterCard";

/** The invite hub: the caller's Recruiter card and one button to share the current league. */
export function InviteHubScreen() {
  const router = useRouter();
  const { leagueId } = useCurrentLeague();
  const { scrollY, onScroll, contentInsetTop } = useCollapsingHeader();
  return (
    <Screen edges={["bottom"]}>
      <Header title="Invite friends" onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))} scrollY={scrollY} />
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: contentInsetTop }}
        scrollIndicatorInsets={{ top: contentInsetTop }}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title="Invite friends" scrollY={scrollY} />
        <RecruiterCard />
        <View style={styles.action}>
          <InviteButton leagueId={leagueId} variant="primary" />
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.lg },
});
