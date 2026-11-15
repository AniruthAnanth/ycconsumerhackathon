import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";

import { socialApi } from "@/components/social/contract";
import { MatchupBody } from "@/components/social/matchup/MatchupBody";
import { Button } from "@/components/ui";
import { SCREEN_MARGIN, spacing } from "@/theme";

import type { Versus } from "./api";
import { VersusPot } from "./VersusPot";

/**
 * A versus is a two-member league, so its matchup is the ordinary one with the
 * pot on top. Until the friend accepts there is no matchup, and the pot panel
 * (code and Share) is the whole screen.
 */
export function VersusMatchup({ versus }: { versus: Versus }) {
  const matchup = useQuery(socialApi.standings.matchup, {
    leagueId: versus.leagueId,
  });
  const router = useRouter();
  // A friend who just accepted has no lineup yet; drafting is the one thing left to do.
  const needsDraft =
    versus.status !== "settled" &&
    (matchup?.rows.every((row) => row.mine === undefined) ?? false);
  return (
    <ScrollView>
      <VersusPot versus={versus} />
      {matchup ? (
        <>
          {needsDraft ? (
            <Button
              label="Draft your lineup"
              style={styles.draft}
              onPress={() => router.push("/draft")}
            />
          ) : null}
          <MatchupBody matchup={matchup} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  draft: { marginHorizontal: SCREEN_MARGIN, marginVertical: spacing.md },
});
