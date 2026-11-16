import { useQuery } from "convex/react";
import { StyleSheet, Text } from "react-native";

import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, fontFamily, spacing, type } from "@/theme";

import { socialApi } from "../contract";
import { verdictLine } from "./sunnyLogic";

/**
 * Sunny's line under the celebration on a passed proof. The matchup query is live, so the gap
 * already includes these points by the time the line fades in.
 */
export function SunnyVerdictLine({ points }: { points: number }) {
  const { leagueId } = useCurrentLeague();
  const matchup = useQuery(socialApi.standings.matchup, leagueId ? { leagueId } : "skip");
  return <Text style={styles.line}>{verdictLine(points, matchup)}</Text>;
}

const styles = StyleSheet.create({
  line: { ...type.body, color: colors.accent, fontFamily: fontFamily.bold, textAlign: "center", marginBottom: spacing.lg },
});
