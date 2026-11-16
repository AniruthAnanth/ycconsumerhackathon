import { useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { PayButton } from "@/components/money/PayButton";
import { ErrorLine } from "@/components/join/ErrorLine";
import { useJoinLeague } from "@/components/join/useJoinLeague";
import { Button, Header, LargeTitle, Screen, useCollapsingHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { DEFAULT_SETTINGS } from "@/convex/lib/schedule";
import { SCREEN_MARGIN, spacing } from "@/theme";

import { SettingsPicker } from "./SettingsPicker";

/**
 * The last step of Create League. Join passes on the name, stake and
 * visibility it collected as route params; this screen adds the three
 * settings and creates the league. From there it is the same path as every
 * other way into a league (useJoinLeague): the league becomes the current
 * one and the contacts step follows.
 */
export function LeagueSettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; stakeUsd: string; visibility: string }>();
  const createLeague = useMutation(api.leagues.create);
  const { join, busy, failure } = useJoinLeague();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const { scrollY, onScroll, contentInsetTop } = useCollapsingHeader();

  const create = () =>
    join("create", () =>
      createLeague({
        name: params.name,
        stakeUsd: Number(params.stakeUsd),
        visibility: params.visibility === "public" ? "public" : "private",
        settings,
      }),
    );

  return (
    <Screen edges={["bottom"]}>
      <Header title="League Settings" onBack={router.back} rightAction={<PayButton />} scrollY={scrollY} />
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: contentInsetTop }}
        scrollIndicatorInsets={{ top: contentInsetTop }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title="League Settings" scrollY={scrollY} />
        <SettingsPicker value={settings} onChange={setSettings} />
      </Animated.ScrollView>
      <View style={styles.footer}>
        {failure ? <ErrorLine message={failure.message} /> : null}
        <Button label="Create League" onPress={create} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm, paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.lg },
});
