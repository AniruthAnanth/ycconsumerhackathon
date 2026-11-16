import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { MatchupOdds } from "@/components/markets/MatchupOdds";
import { CountUp, PressScale } from "@/components/motion";
import { useMarket } from "@/components/markets/useMarket";
import { Avatar, Card } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentLeague } from "@/lib/currentLeague";
import { formatScore } from "@/lib/taskText";
import { colors, fontFamily, layout, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import type { Matchup, MatchupSide } from "../contract";
import { formatRecord, possiblePoints } from "./matchupLogic";

/**
 * Me against the opponent, side by side: name and season record, then the big score with its
 * projection under it. The projection is the market's (markets.week), so it matches the odds cards;
 * where the market has no number for a side the line falls back to the points still possible.
 */
export function MatchupHero({ matchup }: { matchup: Matchup }) {
  const { me, opponent, rows } = matchup;
  const { leagueId } = useCurrentLeague();
  const market = useMarket(leagueId);
  const season = useQuery(api.seasons.overview, leagueId ? { leagueId } : "skip");
  const minePossible = possiblePoints(rows, "mine", me.total);
  const theirsPossible = possiblePoints(rows, "theirs", opponent.total);
  // Before anyone drafts there is nothing to win yet: no "of 0 possible" and no 50/50 bar.
  const undrafted = minePossible === 0 && theirsPossible === 0;
  const recordOf = (userId: Id<"users">) => {
    const row = season?.table.find((entry) => entry.userId === userId);
    return row ? formatRecord(row) : undefined;
  };
  const caption = (projected: number | undefined, possible: number) => {
    if (undrafted) return "Draft to start";
    return projected === undefined ? `of ${formatScore(possible)} possible` : `Proj ${formatScore(projected)}`;
  };
  const opponentProjected = market?.matchup?.opponentId === opponent.userId ? market.matchup.opponent.projected : undefined;
  return (
    <Card style={styles.hero}>
      <View style={styles.sides}>
        <HeroSide side={me} record={recordOf(me.userId)} caption={caption(market?.me.projected, minePossible)} align="flex-start" />
        <HeroSide side={opponent} record={recordOf(opponent.userId)} caption={caption(opponentProjected, theirsPossible)} align="flex-end" />
      </View>
      {undrafted ? null : <MatchupOdds me={{ name: me.name, chance: me.winProbability }} them={{ name: opponent.name, chance: opponent.winProbability }} compact />}
    </Card>
  );
}

function HeroSide({ side, record, caption, align }: { side: MatchupSide; record?: string; caption: string; align: "flex-start" | "flex-end" }) {
  const router = useRouter();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${side.name}'s profile`}
      onPress={() => router.push(`/profile/${side.userId}`)}
      style={[styles.side, { alignItems: align }]}
    >
      <Avatar name={side.name} size={layout.rowMin} />
      <Text style={styles.name} numberOfLines={2}>
        {side.name}
      </Text>
      {record ? <Text style={styles.possible}>{record}</Text> : null}
      <CountUp style={styles.score} value={side.total} format={formatScore} decimals={1} numberOfLines={1} adjustsFontSizeToFit />
      <Text style={styles.possible}>{caption}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: SCREEN_MARGIN, marginTop: spacing.md, paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.lg, gap: spacing.lg },
  sides: { flexDirection: "row", gap: spacing.lg },
  side: { flex: 1, gap: spacing.xs },
  name: { ...type.label, color: colors.textMuted, maxWidth: "100%" },
  score: { ...type.display, color: colors.text, ...tabular, maxWidth: "100%" },
  possible: { color: colors.textFaint, fontFamily: fontFamily.semiBold, fontSize: type.caption.fontSize, ...tabular },
});
