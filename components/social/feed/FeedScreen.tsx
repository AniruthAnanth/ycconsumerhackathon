import { useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { Entrance } from "@/components/motion";
import { socialApi } from "@/components/social/contract";
import { Divider, OutlinedPillButton, Screen } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { useNow } from "@/lib/useNow";
import { colors, font, fontFamily, hairline, SCREEN_MARGIN, spacing } from "@/theme";
import { ScreenState } from "@/components/social/ScreenState";
import { useMyUserId } from "@/components/social/useMyUserId";

import { UpForVeto } from "../veto/UpForVeto";
import { FocusFlash } from "./FocusFlash";
import { ProofPost } from "./ProofPost";

const PostDivider = () => <Divider inset={SCREEN_MARGIN} />;

/**
 * FEED tab: the league's verified proofs, newest first. It is also where the
 * side features start, from the shortcuts above the first post: the week's
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
    <Screen edges={["bottom"]}>
      <FlatList
        ref={list}
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
          <View style={styles.shortcuts}>
            <View style={styles.shortcutRow}>
              <OutlinedPillButton label="Week Wrapped" onPress={() => router.push("/wrapped")} style={styles.shortcut} />
              <OutlinedPillButton label="Connect Canvas" onPress={() => router.push("/canvas")} style={styles.shortcut} />
            </View>
            {/* On its own line: three labels this long do not fit side by side on a phone, and as a
                floating button it sat on top of the second post's points. */}
            <OutlinedPillButton
              label="+ Group Session"
              accessibilityLabel="Start a group session"
              onPress={() => router.push("/group/new")}
            />
          </View>
          <UpForVeto board={board} leagueId={leagueId} myUserId={myUserId} now={now} />
          </>
        }
        ListEmptyComponent={<Text style={styles.empty}>No proofs yet</Text>}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  shortcuts: {
    gap: spacing.md,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.md,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  shortcutRow: { flexDirection: "row", gap: spacing.md },
  shortcut: { flex: 1 },
  empty: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.body, textAlign: "center", paddingVertical: spacing.xxl },
});
