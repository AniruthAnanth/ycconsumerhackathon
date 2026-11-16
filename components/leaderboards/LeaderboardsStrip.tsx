import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { formatNet, useMarket } from "@/components/markets";
import { Icon } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { colors, font, fontFamily, hairline, layout, money, SCREEN_MARGIN } from "@/theme";

import { isProjectedGain, placeLabel } from "./format";
import { useProjection } from "./useProjection";

/** One row for the League and Roster screens: where you stand this week, what you are projected to win, and a way in to the boards. */
export function LeaderboardsStrip({ leagueId }: { leagueId: Id<"leagues"> | null }) {
  const router = useRouter();
  const week = useQuery(api.leaderboards.board, leagueId ? { leagueId, board: "week" } : "skip");
  const projection = useProjection(leagueId);
  // A weekly pot shows the Matchup card's own figure, so the two can never disagree; a season
  // payout or a settled week keeps the leaderboards projection, which knows about both.
  const market = useMarket(leagueId);
  const live = market?.payout.eligible ? market.payout : undefined;
  // An unpaid player's projection is only "Pay $N to play for the pot", which the Pay banner
  // above already says; repeated here it squeezed the rank into a narrow column.
  if (!leagueId) return null;

  const place = week ? placeLabel(week.rows) : undefined;
  return (
    <Pressable style={styles.strip} onPress={() => router.push("/leaderboards")} accessibilityRole="button" accessibilityLabel="Open leaderboards">
      {/* Without a label the place read as a stray "1st" at the top of the League tab. */}
      {place ? <Text style={styles.label}>YOUR RANK</Text> : null}
      <Text style={styles.place} numberOfLines={1}>
        {place ?? "Leaderboards"}
      </Text>
      {live ? (
        <Text style={[styles.projection, live.expectedNetUsd >= 0.5 && styles.gain]}>{`Projected ${formatNet(live.expectedNetUsd)}`}</Text>
      ) : projection?.eligible ? (
        <Text style={[styles.projection, isProjectedGain(projection) && styles.gain]} numberOfLines={2}>
          {projection.label}
        </Text>
      ) : null}
      <Icon name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    minHeight: layout.rowMin,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
    backgroundColor: colors.background,
    borderTopWidth: hairline,
    borderBottomWidth: hairline,
    borderColor: colors.divider,
  },
  label: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted, letterSpacing: 0.6 },
  place: { flex: 1, fontSize: font.body, fontFamily: fontFamily.semiBold, color: colors.text },
  // A long label ("Pay $5 to play for the pot") wraps in its own column instead of squeezing the place into a sliver.
  projection: { maxWidth: "45%", flexShrink: 1, textAlign: "right", fontSize: font.body, fontFamily: fontFamily.bold, color: colors.text },
  gain: { color: money.text },
});
