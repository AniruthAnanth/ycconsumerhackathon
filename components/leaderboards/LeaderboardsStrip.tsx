import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { Icon } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { colors, font, fontFamily, hairline, spacing } from "@/theme";

import { isProjectedGain, placeLabel } from "./format";
import { useProjection } from "./useProjection";

/** One row for the League and Roster screens: where you stand this week, what you are projected to win, and a way in to the boards. */
export function LeaderboardsStrip({ leagueId }: { leagueId: Id<"leagues"> | null }) {
  const router = useRouter();
  const week = useQuery(api.leaderboards.board, leagueId ? { leagueId, board: "week" } : "skip");
  const projection = useProjection(leagueId);
  if (!leagueId) return null;

  const place = week ? placeLabel(week.rows) : undefined;
  return (
    <Pressable style={styles.strip} onPress={() => router.push("/leaderboards")} accessibilityRole="button" accessibilityLabel="Open leaderboards">
      {/* Without a label the place read as a stray "1st" at the top of the League tab. */}
      {place ? <Text style={styles.label}>YOUR RANK</Text> : null}
      <Text style={styles.place} numberOfLines={1}>
        {place ?? "Leaderboards"}
      </Text>
      {projection ? (
        <Text style={[styles.projection, isProjectedGain(projection) && styles.gain]} numberOfLines={1}>
          {projection.label}
        </Text>
      ) : null}
      <Icon name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: hairline,
    borderBottomWidth: hairline,
    borderColor: colors.divider,
  },
  label: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted, letterSpacing: 0.6 },
  place: { flex: 1, fontSize: font.body, fontFamily: fontFamily.semiBold, color: colors.text },
  projection: { fontSize: font.body, fontFamily: fontFamily.bold, color: colors.text },
  gain: { color: colors.tabActive },
});
