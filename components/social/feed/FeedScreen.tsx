import { useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Entrance } from "@/components/motion";
import { socialApi } from "@/components/social/contract";
import { Divider, Icon, type IconName, OutlinedPillButton, Screen, useTabBarInset } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { useNow } from "@/lib/useNow";
import { colors, font, fontFamily, hairline, layout, SCREEN_MARGIN, spacing } from "@/theme";
import { ScreenState } from "@/components/social/ScreenState";
import { useMyUserId } from "@/components/social/useMyUserId";

import { SunnyCard } from "../sunny/SunnyCard";
import { UpForVeto } from "../veto/UpForVeto";
import { FocusFlash } from "./FocusFlash";
import { ProofPost } from "./ProofPost";

const PostDivider = () => <Divider inset={SCREEN_MARGIN} />;

/** One quiet text link in the shortcut row: the side features stay a tap away without leading the Feed. */
function Shortcut({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={spacing.xs} style={styles.shortcut}>
      <Icon name={icon} size={font.meta} color={colors.textMuted} />
      <Text style={styles.shortcutText}>{label}</Text>
    </Pressable>
  );
}

/**
 * FEED tab: the league's verified proofs, newest first. It is also where the
 * side features start, from the shortcuts under the last post: the week's
 * wrapped, Canvas and a group session.
 */
export function FeedScreen() {
  const router = useRouter();
  const { leagueId } = useCurrentLeague();
  const myUserId = useMyUserId();
  const feed = useQuery(socialApi.feed.list, leagueId ? { leagueId } : "skip");
  const board = useQuery(socialApi.vetoes.board, leagueId ? { leagueId } : "skip");
  const memberCount = useQuery(backend.leagues.get, leagueId ? { leagueId } : "skip")?.memberCount;
  const now = useNow(60_000);
  const bottomInset = useTabBarInset();
  const list = useRef<FlatList<NonNullable<typeof feed>[number]>>(null);
  const { proofId } = useLocalSearchParams<{ proofId?: string }>();
  const [focused, setFocused] = useState<string>();

  // A live toast opens this tab with ?proofId=. Scroll that post into view once it is in the list,
  // flash it, then clear the param so coming back to the tab does not jump again.
  const focusIndex = proofId && feed ? feed.findIndex((item) => item.proofId === proofId) : -1;
  useEffect(() => {
    if (focusIndex < 0) return;
    list.current?.scrollToIndex({ index: focusIndex, viewPosition: 0 });
    setFocused(proofId);
    router.setParams({ proofId: undefined });
  }, [focusIndex, proofId, router]);

  if (!leagueId || feed === undefined) return <ScreenState loading />;

  return (
    <Screen edges={[]}>
      <FlatList
        ref={list}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        scrollIndicatorInsets={{ bottom: bottomInset }}
        data={feed}
        keyExtractor={(item) => item.proofId}
        renderItem={({ item, index }) => (
          <Entrance index={index}>
            <FocusFlash active={item.proofId === focused}>
              <ProofPost item={item} leagueId={leagueId} memberCount={memberCount} myUserId={myUserId} now={now} />
            </FocusFlash>
          </Entrance>
        )}
        ItemSeparatorComponent={PostDivider}
        // Posts vary in height, so a far post may not be measured yet: jump near it, then retry.
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          list.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
          setTimeout(() => list.current?.scrollToIndex({ index, viewPosition: 0 }), 100);
        }}
        ListHeaderComponent={
          <>
          <SunnyCard />
          <UpForVeto board={board} leagueId={leagueId} myUserId={myUserId} now={now} />
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyBlock}>
            <Text style={styles.empty}>No proofs yet</Text>
            <OutlinedPillButton label="Submit your first proof" onPress={() => router.navigate("/")} />
          </View>
        }
        // The side features follow the posts: the Feed answers "what happened?" first.
        ListFooterComponent={
            <View style={styles.shortcuts}>
              <Shortcut icon="sparkles-outline" label="Week Wrapped" onPress={() => router.push("/wrapped")} />
              <Shortcut icon="school-outline" label="Connect Canvas" onPress={() => router.push("/canvas")} />
              <Shortcut icon="people-outline" label="Group session" onPress={() => router.push("/group/new")} />
            </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  shortcuts: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SCREEN_MARGIN,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  shortcut: { minHeight: layout.rowMin, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  shortcutText: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: font.label },
  emptyBlock: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: SCREEN_MARGIN },
  empty: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.body, textAlign: "center" },
});
