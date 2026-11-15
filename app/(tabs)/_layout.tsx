import { useRouter, useSegments } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Header, TopTabs, WeekSelector } from "@/components/ui";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors } from "@/theme";

const TABS = [
  { key: "index", label: "Roster", href: "/" },
  { key: "matchup", label: "Matchup", href: "/matchup" },
  { key: "feed", label: "Feed", href: "/feed" },
  { key: "league", label: "League", href: "/league" },
] as const;

/**
 * The home of the app, laid out like ESPN's team screen: header, the four top
 * tabs, the week selector, then the active tab. The bar is drawn here once
 * rather than by each tab, so it stays put while the content below changes.
 */
export default function TabsLayout() {
  const router = useRouter();
  const { weekNumber } = useCurrentLeague();
  // Segments are ["(tabs)"] on Roster and ["(tabs)", "matchup"] on the others.
  const tabSegment = (useSegments() as string[])[1];
  const active = TABS.find((tab) => tab.key === tabSegment) ?? TABS[0];

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]}>
        <Header title="Lineup" onChatPress={() => router.push("/chat")} />
        <TopTabs
          tabs={TABS}
          active={active.key}
          onChange={(key) => router.navigate(TABS.find((tab) => tab.key === key)!.href)}
        />
        <WeekSelector label={`Week ${weekNumber ?? 1}`} onLongPress={() => router.push("/demo")} />
      </SafeAreaView>
      {/* The navigator keeps each tab mounted; its own bottom bar is replaced by TopTabs above. */}
      <Tabs tabBar={() => null} screenOptions={{ headerShown: false, sceneStyle: styles.page }}>
        {TABS.map((tab) => (
          <Tabs.Screen key={tab.key} name={tab.key} />
        ))}
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
});
