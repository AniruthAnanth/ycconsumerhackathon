import { useQuery } from "convex/react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { PressScale } from "@/components/motion";
import { Avatar } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatScore } from "@/lib/taskText";
import { BORDER, colors, fontFamily, radius, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import { shortName } from "./matchupLogic";

const AVATAR = 20;

/**
 * Every pairing in the league this week, as seasons.overview schedules and scores it. Only the
 * caller's card is selectable: standings.matchup answers for the caller's own pairing and takes no
 * other, so the rest of the strip is a scoreboard to read, not a way in. The caller's own card is
 * only an outline around the two avatars: the hero right below already shows those names and scores.
 */
export function MatchupTicker({ leagueId }: { leagueId: Id<"leagues"> }) {
  const season = useQuery(api.seasons.overview, { leagueId });
  const week = season?.weeks.find((entry) => entry.number === season.currentWeek);
  if (!season || !week || week.matchups.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} testID="matchup-ticker">
      {week.matchups.map((pairing) => {
        const mine = pairing.a.userId === season.meId || pairing.b.userId === season.meId;
        const label = `${pairing.a.name} ${formatScore(pairing.scoreA ?? 0)}, ${pairing.b.name} ${formatScore(pairing.scoreB ?? 0)}`;
        return (
          <PressScale
            key={`${pairing.a.userId}-${pairing.b.userId}`}
            accessibilityRole="button"
            accessibilityLabel={mine ? `Your matchup: ${label}` : label}
            accessibilityState={{ selected: mine, disabled: !mine }}
            disabled={!mine}
            style={[styles.card, mine && styles.cardMine]}
          >
            {[
              { player: pairing.a, score: pairing.scoreA },
              { player: pairing.b, score: pairing.scoreB },
            ].map(({ player, score }) =>
              mine ? (
                <Avatar key={player.userId} uri={player.avatarUrl} name={player.name} size={AVATAR} />
              ) : (
                <View key={player.userId} style={styles.line}>
                  <Avatar uri={player.avatarUrl} name={player.name} size={AVATAR} />
                  <Text style={styles.name} numberOfLines={1}>
                    {shortName(player.name)}
                  </Text>
                  <Text style={styles.score}>{score === null ? "\u2014" : formatScore(score)}</Text>
                </View>
              ),
            )}
          </PressScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { paddingHorizontal: SCREEN_MARGIN, paddingTop: spacing.md, gap: spacing.sm },
  card: { width: 132, gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, borderWidth: BORDER, borderColor: colors.divider },
  cardMine: { width: undefined, flexDirection: "row", alignItems: "center", borderColor: colors.accent },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { flex: 1, color: colors.text, fontFamily: fontFamily.semiBold, fontSize: type.caption.fontSize },
  score: { ...type.label, color: colors.text, ...tabular },
});
