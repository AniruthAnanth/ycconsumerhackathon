import { TabList, Tabs, TabSlot, TabTrigger } from "expo-router/ui";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TopTab } from "@/components/TopTab";
import { colors, hairline } from "@/theme";

export default function TabsLayout() {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Tabs>
        <TabList style={styles.tabList}>
          <TabTrigger name="roster" href="/" asChild>
            <TopTab>ROSTER</TopTab>
          </TabTrigger>
          <TabTrigger name="matchup" href="/matchup" asChild>
            <TopTab>MATCHUP</TopTab>
          </TabTrigger>
          <TabTrigger name="feed" href="/feed" asChild>
            <TopTab>FEED</TopTab>
          </TabTrigger>
          <TabTrigger name="league" href="/league" asChild>
            <TopTab>LEAGUE</TopTab>
          </TabTrigger>
        </TabList>
        <TabSlot />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabList: {
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
});
