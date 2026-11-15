import { useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { RecruiterBadge } from "@/components/invite";
import { Avatar, Divider, Header, OutlinedPillButton, PositionPill, Score, Screen, SectionLabel, SLOT_NAME } from "@/components/ui";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing, type } from "@/theme";

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
  const router = useRouter();
  const { me } = useCurrentLeague();

  return (
    <Screen scroll>
      <Header title="Profile" onBack={leaveScreen} />
      {profile === undefined ? (
        <ScreenState loading />
      ) : (
        <>
          <View style={styles.top}>
            <Avatar uri={profile.avatarUrl} name={profile.name} size={spacing.xxl * 2} />
            <View style={styles.nameBlock}>
              <Text style={styles.name} numberOfLines={2}>
                {profile.name}
              </Text>
              <RecruiterBadge userId={userId as Id<"users">} />
            </View>
            <View style={styles.total}>
              <Score value={profile.totalPoints} size="total" />
              <Text style={styles.totalLabel}>TOTAL POINTS</Text>
            </View>
          </View>
          <Divider />
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
          {me?._id === userId ? (
            <View style={styles.help}>
              <OutlinedPillButton
                label="How Lineup works"
                icon="help-circle-outline"
                onPress={() => router.push({ pathname: "/how-it-works", params: { source: "profile" } })}
              />
            </View>
          ) : null}
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
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.xl,
  },
  nameBlock: { flex: 1, gap: spacing.xs },
  help: { padding: SCREEN_MARGIN },
  name: { ...type.heading, flexShrink: 1, color: colors.text },
  total: { alignItems: "flex-end", flexShrink: 0 },
  totalLabel: { fontSize: font.label, fontFamily: fontFamily.semiBold, letterSpacing: 0.6, color: colors.textMuted },
  bestSlot: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  slotName: { fontSize: font.score, fontFamily: fontFamily.bold, color: colors.text },
});
