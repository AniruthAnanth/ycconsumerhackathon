import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { Entrance } from "@/components/motion";
import { socialApi } from "@/components/social/contract";
import { Divider, OutlinedPillButton, Screen } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { useNow } from "@/lib/useNow";
import { colors, fontFamily } from "@/theme";
import { ScreenState } from "@/components/social/ScreenState";
import { useMyUserId } from "@/components/social/useMyUserId";

import { ProofPost } from "./ProofPost";

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
  const memberCount = useQuery(backend.leagues.get, leagueId ? { leagueId } : "skip")?.memberCount;
  const now = useNow(60_000);

  if (!leagueId || feed === undefined) return <ScreenState loading />;

  return (
    <Screen edges={["bottom"]}>
      <FlatList
        data={feed}
        keyExtractor={(item) => item.proofId}
        renderItem={({ item, index }) => (
          <Entrance index={index}>
            <ProofPost item={item} leagueId={leagueId} memberCount={memberCount} myUserId={myUserId} now={now} />
          </Entrance>
        )}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={
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
        }
        ListEmptyComponent={<Text style={styles.empty}>No proofs yet</Text>}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  shortcuts: {
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  shortcutRow: { flexDirection: "row", gap: 12 },
  shortcut: { flex: 1 },
  empty: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 15, textAlign: "center", paddingVertical: 48 },
});
