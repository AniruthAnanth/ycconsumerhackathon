import { Redirect, useRouter, useSegments } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LeagueSwitcher } from "@/components/shell/LeagueSwitcher";
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
 *
 * It is also the front door: a player who has not given a name and phone, or
 * is in no league yet, is sent to do that first.
 */
export default function TabsLayout() {
  const router = useRouter();
  const { me, leagueId, setLeagueId, membership, weekNumber, showPreviousWeek, showNextWeek } = useCurrentLeague();
  const [switching, setSwitching] = useState(false);
  // Segments are ["(tabs)"] on Roster and ["(tabs)", "matchup"] on the others.
  const tabSegment = (useSegments() as string[])[1];
  const active = TABS.find((tab) => tab.key === tabSegment) ?? TABS[0];

  if (me === undefined) return <View style={styles.page} />;
  if (me === null || !me.onboarded) return <Redirect href="/onboarding" />;
  if (me.leagues.length === 0) return <Redirect href="/join" />;

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]}>
        <Header
          title={membership?.name ?? "Lineup"}
          onTitlePress={() => setSwitching(true)}
          onChatPress={() => router.push("/chat")}
        />
        <TopTabs
          tabs={TABS}
          active={active.key}
          onChange={(key) => router.navigate(TABS.find((tab) => tab.key === key)!.href)}
        />
        <WeekSelector
          label={weekNumber === undefined ? "Week" : `Week ${weekNumber}`}
          onPrev={showPreviousWeek}
          onNext={showNextWeek}
          onLongPress={() => router.push("/demo")}
        />
      </SafeAreaView>
      {/* The navigator keeps each tab mounted; its own bottom bar is replaced by TopTabs above. */}
      <Tabs tabBar={() => null} screenOptions={{ headerShown: false, sceneStyle: styles.page }}>
        {TABS.map((tab) => (
          <Tabs.Screen key={tab.key} name={tab.key} />
        ))}
      </Tabs>
      <LeagueSwitcher
        visible={switching}
        leagues={me.leagues}
        currentId={leagueId}
        onPick={(id) => {
          setLeagueId(id);
          setSwitching(false);
        }}
        onJoin={() => {
          setSwitching(false);
          router.push("/join");
        }}
        onClose={() => setSwitching(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
});
