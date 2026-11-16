import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { useSunnyHop } from "@/components/motion";

import { socialApi } from "@/components/social/contract";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, font, fontFamily, MIN_TARGET, radius, spacing } from "@/theme";

import { SunnyAvatar } from "./SunnyAvatar";
import { SUNNY } from "./sunnyLogic";
import { useSunny } from "./useSunny";

/**
 * The header's way into the chat: Sunny's face, with the league thread's unread count when there is one,
 * otherwise a dot when Sunny has a line the player hasn't opened.
 */
export function SunnyButton() {
  const router = useRouter();
  const { leagueId } = useCurrentLeague();
  const { unread, brief } = useSunny();
  const groupUnread = useQuery(socialApi.leagueChat.unread, leagueId ? { leagueId } : "skip") ?? 0;
  const label = groupUnread > 0 ? `Chat, ${groupUnread} unread` : unread ? `Chat with ${SUNNY.name}, new` : `Chat with ${SUNNY.name}`;
  return (
    <Pressable onPress={() => router.push("/chat")} style={styles.target} accessibilityRole="button" accessibilityLabel={label}>
      {/* Each new unread line or post mounts a fresh face, which bounces once; once read, Sunny stays still. */}
      {groupUnread > 0 ? (
        <BouncingFace key={`count-${groupUnread}`} count={groupUnread} />
      ) : unread ? (
        <BouncingFace key={brief?.line} />
      ) : (
        <SunnyAvatar size={FACE} face />
      )}
    </Pressable>
  );
}

function BouncingFace({ count }: { count?: number }) {
  const hop = useSunnyHop(FACE);
  return (
    <Animated.View style={hop}>
      <SunnyAvatar size={FACE} face />
      {count ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      ) : (
        <View style={styles.dot} />
      )}
    </Animated.View>
  );
}

const FACE = 36;
const DOT = 10;
const BADGE = 18;

const styles = StyleSheet.create({
  target: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, alignItems: "flex-end", justifyContent: "center" },
  dot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    // Green, not red: something new from Sunny is good news, not an error.
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badge: {
    position: "absolute",
    top: -spacing.xs,
    right: -spacing.sm,
    minWidth: BADGE,
    height: BADGE,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { color: colors.onAccent, fontFamily: fontFamily.bold, fontSize: font.label },
});
