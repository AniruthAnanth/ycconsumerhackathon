import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { ErrorLine } from "@/components/join/ErrorLine";
import { Header, LargeTitle, OutlinedPillButton, Screen, useCollapsingHeader } from "@/components/ui";
import { unmentionedStats } from "@/convex/lib/decree";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import type { Id } from "@/convex/_generated/dataModel";
import { socialApi } from "../contract";
import { leaveScreen } from "../leave";
import { ScreenState } from "../ScreenState";
import { DecreeScroll } from "./DecreeScroll";
import { ProfileIdentity } from "./ProfileIdentity";
import { useDecree } from "./useDecree";

export function ProfileScreen() {
  const { userId: rawUserId } = useLocalSearchParams<{ userId: string }>();
  const userId = rawUserId as Id<"users">;
  const profile = useQuery(socialApi.profile.get, { userId });
  const { data, writing, error, reroll } = useDecree(userId);
  const { me } = useCurrentLeague();
  const { scrollY, onScroll, contentInsetTop } = useCollapsingHeader();
  const own = me?._id === userId;
  const decree = data?.decree ?? null;
  const footer = data && decree ? unmentionedStats(decree.text, data.stats) : [];

  return (
    <Screen edges={["bottom"]}>
      <Header title="Profile" onBack={leaveScreen} scrollY={scrollY} />
      <Animated.ScrollView
        contentContainerStyle={[styles.content, { paddingTop: contentInsetTop }]}
        scrollIndicatorInsets={{ top: contentInsetTop }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title="Profile" scrollY={scrollY} />
        {profile === undefined ? (
          <ScreenState loading />
        ) : (
          <View style={styles.body}>
            <DecreeScroll>
              <ProfileIdentity userId={userId} name={profile.name} avatarUrl={profile.avatarUrl} own={own} />
              {decree ? (
                <>
                  <Text style={styles.decree}>{decree.text}</Text>
                  {decree.epithet ? <Text style={styles.epithet}>{decree.epithet}</Text> : null}
                </>
              ) : error ? (
                <ErrorLine message={error} />
              ) : (
                <View style={styles.writing}>
                  <ActivityIndicator color={colors.textMuted} />
                  <Text style={styles.writingLabel}>The herald is writing</Text>
                </View>
              )}
              {footer.length > 0 ? (
                <View style={styles.footer}>
                  <Text style={styles.footerTitle}>BY THE NUMBERS</Text>
                  <View style={styles.footerGrid}>
                    {footer.map((stat) => (
                      <View key={stat.label} style={styles.footerStat}>
                        <Text style={styles.footerValue}>{stat.value}</Text>
                        <Text style={styles.footerLabel}>{stat.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </DecreeScroll>
            <View style={styles.actions}>
              {own && (decree || error) ? (
                <OutlinedPillButton
                  label={writing ? "Rerolling" : "Reroll"}
                  icon="refresh"
                  disabled={writing}
                  haptic="none"
                  onPress={() => void reroll()}
                />
              ) : null}
            </View>
          </View>
        )}
      </Animated.ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  body: { paddingHorizontal: SCREEN_MARGIN },
  decree: { fontFamily: fontFamily.regular, fontSize: font.title, lineHeight: font.title * 1.45, color: colors.text },
  epithet: { ...type.heading, fontSize: font.title, color: colors.warning, textAlign: "center" },
  writing: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  writingLabel: { fontFamily: fontFamily.semiBold, fontSize: font.title, color: colors.textMuted },
  footer: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: spacing.md },
  footerTitle: { fontSize: font.label, fontFamily: fontFamily.semiBold, letterSpacing: 0.6, color: colors.textMuted },
  footerGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.md },
  footerStat: { width: "50%" },
  footerValue: { fontFamily: fontFamily.bold, fontSize: font.score, color: colors.text, ...tabular },
  footerLabel: { fontFamily: fontFamily.regular, fontSize: font.label, color: colors.textMuted },
  actions: { alignItems: "flex-start", gap: spacing.md, paddingBottom: spacing.xl },
});
