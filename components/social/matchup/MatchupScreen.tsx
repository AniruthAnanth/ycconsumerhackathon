import { useQuery } from "convex/react";
import { ScrollView } from "react-native";

import { SectionLabel } from "@/components/ui";
import { useCurrentLeague } from "@/lib/currentLeague";

import { socialApi } from "../contract";
import { ScreenState } from "../ScreenState";
import { SlotRow } from "./SlotRow";
import { TeamHeaders } from "./TeamHeaders";
import { WinProbabilityBar } from "./WinProbabilityBar";

export default function MatchupScreen() {
  const { leagueId } = useCurrentLeague();
  const matchup = useQuery(socialApi.standings.matchup, leagueId ? { leagueId } : "skip");

  if (matchup === undefined) return <ScreenState loading />;
  if (matchup === null) return <ScreenState message="No matchup this week" />;

  return (
    <ScrollView>
      <TeamHeaders me={matchup.me} opponent={matchup.opponent} />
      <WinProbabilityBar mine={matchup.me.winProbability} theirs={matchup.opponent.winProbability} />
      <SectionLabel left="Matchup" />
      {matchup.rows.map((row) => (
        <SlotRow key={row.slot} row={row} />
      ))}
    </ScrollView>
  );
}
