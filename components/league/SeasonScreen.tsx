import { useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type ComponentRef, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { PayButton } from "@/components/money/PayButton";
import { Header, Screen, SectionLabel, TopTabs } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors } from "@/theme";

import { SeasonBracket } from "./SeasonBracket";
import { SeasonSchedule } from "./SeasonSchedule";
import { SeasonTable } from "./SeasonTable";
import { seasonProgress, settingsSummary } from "./settings";

type Tab = "schedule" | "standings" | "bracket";

/**
 * The league's season: every week's matchups and results, the win-loss table
 * and, for a bracket league, the playoff bracket. One query feeds all three,
 * so the tabs switch without loading.
 */
export function SeasonScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ leagueId?: Id<"leagues"> }>();
  const current = useCurrentLeague();
  const leagueId = params.leagueId ?? current.leagueId;
  const season = useQuery(api.seasons.overview, leagueId ? { leagueId } : "skip");
  const [tab, setTab] = useState<Tab>("schedule");

  // The schedule opens at the week being played; the weeks above it are history.
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const openedAtCurrentWeek = useRef(false);
  const showCurrentWeek = (event: LayoutChangeEvent) => {
    if (openedAtCurrentWeek.current) return;
    openedAtCurrentWeek.current = true;
    scroll.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false });
  };

  if (season === undefined) {
    return (
      <Screen>
        <Header title="Season" onBack={router.back} rightAction={<PayButton />} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.textMuted} />
        </View>
      </Screen>
    );
  }

  const { settings, meId } = season;
  const openProfile = (userId: string) => router.push({ pathname: "/profile/[userId]", params: { userId } });
  const tabs: { key: Tab; label: string }[] = [
    { key: "schedule", label: "Schedule" },
    { key: "standings", label: "Standings" },
    ...(season.bracket ? [{ key: "bracket" as const, label: "Bracket" }] : []),
  ];

  return (
    <Screen>
      <Header title="Season" onBack={router.back} rightAction={<PayButton />} />
      <SectionLabel
        left={seasonProgress(season.season, season.currentWeek, settings.seasonWeeks)}
        right={settingsSummary(settings)}
      />
      <TopTabs
        tabs={tabs}
        active={tab}
        onChange={(next) => {
          openedAtCurrentWeek.current = false;
          setTab(next);
        }}
      />
      <ScrollView ref={scroll}>
        {tab === "schedule"
          ? season.weeks.map((week) => (
              <View key={week.number} onLayout={week.number === season.currentWeek ? showCurrentWeek : undefined}>
                <SeasonSchedule weeks={[week]} meId={meId} onPlayerPress={openProfile} />
              </View>
            ))
          : null}
        {tab === "standings" ? <SeasonTable rows={season.table} meId={meId} onPlayerPress={openProfile} /> : null}
        {tab === "bracket" && season.bracket ? (
          <SeasonBracket bracket={season.bracket} meId={meId} onPlayerPress={openProfile} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
