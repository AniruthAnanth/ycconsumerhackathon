import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { socialApi } from "@/components/social/contract";
import { Divider, OutlinedPillButton, Screen } from "@/components/ui";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors } from "@/theme";
import { ScreenState } from "@/components/social/ScreenState";
import { useMyUserId } from "@/components/social/useMyUserId";

import { ProofPost } from "./ProofPost";

/**
 * FEED tab: the league's verified proofs, newest first. It is also where the
 * side features start: the week's wrapped, Canvas, and, from the floating
 * button, a group session.
 */
export function FeedScreen() {
  const router = useRouter();
  const { leagueId } = useCurrentLeague();
  const myUserId = useMyUserId();
  const feed = useQuery(socialApi.feed.list, leagueId ? { leagueId } : "skip");
  const now = useNow();

  if (!leagueId || feed === undefined) return <ScreenState loading />;

  return (
    <Screen edges={["bottom"]}>
      <FlatList
        data={feed}
        keyExtractor={(item) => item.proofId}
        renderItem={({ item }) => <ProofPost item={item} leagueId={leagueId} myUserId={myUserId} now={now} />}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={
          <View style={styles.shortcuts}>
            <OutlinedPillButton label="Week Wrapped" onPress={() => router.push("/wrapped")} style={styles.shortcut} />
            <OutlinedPillButton label="Connect Canvas" onPress={() => router.push("/canvas")} style={styles.shortcut} />
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No proofs yet</Text>}
        contentContainerStyle={styles.content}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start a group session"
        onPress={() => router.push("/group/new")}
        style={({ pressed }) => [styles.floating, pressed && styles.floatingPressed]}
      >
        <Text style={styles.floatingLabel}>+ Group Session</Text>
      </Pressable>
    </Screen>
  );
}

/** The current time, refreshed each minute so ages and vote countdowns stay honest while the feed sits open. */
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const styles = StyleSheet.create({
  // Room under the last post so the floating button never covers its actions.
  content: { paddingBottom: 96 },
  shortcuts: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  shortcut: { flex: 1 },
  empty: { color: colors.textMuted, fontSize: 15, textAlign: "center", paddingVertical: 48 },
  floating: {
    position: "absolute",
    right: 16,
    bottom: 24,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingPressed: { opacity: 0.7 },
  floatingLabel: { color: colors.background, fontSize: 15, fontWeight: "700" },
});
