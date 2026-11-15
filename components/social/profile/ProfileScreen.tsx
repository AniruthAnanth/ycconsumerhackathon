import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Avatar, Header, PositionPill, Score, Screen, SectionLabel, SLOT_NAME } from "@/components/ui";
import { colors, font, hairline, spacing } from "@/theme";

import type { Id } from "@/convex/_generated/dataModel";
import { socialApi } from "../contract";
import { leaveScreen } from "../leave";
import { ScreenState } from "../ScreenState";
import { formatDuration, formatPercent, formatPoints, formatStreak } from "./profileLogic";
import { StatRow } from "./StatRow";

const NO_VALUE = "\u2014";

export function ProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const profile = useQuery(socialApi.profile.get, { userId: userId as Id<"users"> });

  return (
    <Screen scroll>
      <Header title="Profile" onBack={leaveScreen} />
      {profile === undefined ? (
        <ScreenState loading />
      ) : (
        <>
          <View style={styles.top}>
            <Avatar uri={profile.avatarUrl} name={profile.name} size={72} />
            <Text style={styles.name} numberOfLines={2}>
              {profile.name}
            </Text>
            <View style={styles.total}>
              <Score value={profile.totalPoints} size="total" />
              <Text style={styles.totalLabel}>TOTAL POINTS</Text>
            </View>
          </View>
          <SectionLabel left="SEASON" />
          <StatRow label="Tasks completed" value={String(profile.tasksCompleted)} />
          <StatRow label="Completion rate" value={formatPercent(profile.completionRate)} />
          <StatRow label="Best slot">
            {profile.bestSlot ? (
              <View style={styles.bestSlot}>
                <PositionPill slot={profile.bestSlot} />
                <Text style={styles.slotName}>{SLOT_NAME[profile.bestSlot]}</Text>
              </View>
            ) : (
              <Text style={styles.slotName}>{NO_VALUE}</Text>
            )}
          </StatRow>
          <StatRow label="Current streak" value={formatStreak(profile.currentStreak)} />
          <StatRow label="Longest streak" value={formatStreak(profile.longestStreak)} />
          <SectionLabel left="RECORDS" />
          <StatRow label="Best week" value={formatPoints(profile.bestWeek)} />
          <StatRow
            label="Fastest quick-time"
            value={profile.fastestQuickTimeSec === undefined ? NO_VALUE : formatDuration(profile.fastestQuickTimeSec)}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  name: { flex: 1, fontSize: 22, fontWeight: "700", color: colors.text },
  total: { alignItems: "flex-end" },
  totalLabel: { fontSize: font.label, fontWeight: "600", letterSpacing: 0.6, color: colors.textMuted },
  bestSlot: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  slotName: { fontSize: font.score, fontWeight: "700", color: colors.text },
});
