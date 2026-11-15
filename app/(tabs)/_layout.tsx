import { Redirect, useRouter, useSegments } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePaidHaptic } from "@/components/shell/usePaidHaptic";
import { Header, TopTabs, WeekSelector } from "@/components/ui";
import { useCurrentLeague } from "@/lib/currentLeague";
import { haptics } from "@/lib/native/haptics";
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
  const { me, membership, league, weekNumber, showPreviousWeek, showNextWeek } = useCurrentLeague();
  // Segments are ["(tabs)"] on Roster and ["(tabs)", "matchup"] on the others. While a sheet
  // such as the league switcher sits over the tabs, the segments name the sheet instead, so the
  // last tab is kept rather than snapping the underline back to Roster behind it.
  const segments = useSegments() as string[];
  const lastTab = useRef<(typeof TABS)[number]>(TABS[0]);
  if (segments[0] === "(tabs)") lastTab.current = TABS.find((tab) => tab.key === segments[1]) ?? TABS[0];
  const active = lastTab.current;
  usePaidHaptic(membership);
  // Only Roster can show another week. The other tabs always show the current
  // one, so the header must say so instead of following the browsed week.
  const browsable = active.key === "index";
  const shownWeek = browsable ? weekNumber : league?.week.number;

  if (me === undefined) return <View style={styles.page} />;
  // A league is proof the player has been through the front door. `onboarded`
  // alone is not: the backend moves a phone number to the newest account that
  // enters it, which clears the flag on the older one, and that must not throw
  // a player out of a week they are already playing.
  const playing = me !== null && me.leagues.length > 0;
  if (!playing) return <Redirect href={me?.onboarded ? "/join" : "/onboarding"} />;

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]}>
        <Header
          title={membership?.name ?? "Lineup"}
          onTitlePress={() => router.push("/league-switcher")}
          onChatPress={() => router.push("/chat")}
        />
        <TopTabs
          tabs={TABS}
          active={active.key}
          onChange={(key) => {
            if (key !== active.key) haptics.select();
            router.navigate(TABS.find((tab) => tab.key === key)!.href);
          }}
        />
        <WeekSelector
          label={shownWeek === undefined ? "Week" : `Week ${shownWeek}`}
          arrows={browsable}
          onPrev={withSelectHaptic(showPreviousWeek)}
          onNext={withSelectHaptic(showNextWeek)}
          onLongPress={() => router.push("/demo")}
        />
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

/** Keeps an absent handler absent, so WeekSelector still greys the chevron at either end. */
function withSelectHaptic(action: (() => void) | undefined) {
  if (!action) return undefined;
  return () => {
    haptics.select();
    action();
  };
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
});
