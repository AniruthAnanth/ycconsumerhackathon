import { useQuery } from "convex/react";
import { ScrollView } from "react-native";

import { ChallengeButton } from "@/components/versus/ChallengeButton";
import { VersusMatchup } from "@/components/versus/VersusMatchup";
import { api } from "@/convex/_generated/api";
import { useCurrentLeague } from "@/lib/currentLeague";

import { socialApi } from "../contract";
import { ScreenState } from "../ScreenState";
import { MatchupBody } from "./MatchupBody";

export default function MatchupScreen() {
  const { leagueId, league, weekStart } = useCurrentLeague();
  // standings.matchup takes no week, so it only ever answers for the current one; weekStart is set once the header steps away from it.
  const otherWeek = weekStart !== undefined;
  const matchup = useQuery(socialApi.standings.matchup, leagueId && !otherWeek ? { leagueId } : "skip");
  const versus = useQuery(api.versus.get, leagueId ? { leagueId } : "skip");

  if (otherWeek) return <ScreenState message={`Matchups are only shown for the current week (Week ${league?.week.number}).`} />;
  // A versus has its own matchup view: the pot on top, and something to show before the friend accepts.
  if (versus) return <VersusMatchup versus={versus} />;
  if (matchup === undefined || versus === undefined) return <ScreenState loading />;
  if (matchup === null) return <ScreenState message="No matchup this week" />;

  return (
    <ScrollView>
      <MatchupBody matchup={matchup} />
      <ChallengeButton />
    </ScrollView>
  );
}
