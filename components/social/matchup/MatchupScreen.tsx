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
  const { leagueId, league, weekStart } = useCurrentLeague();
  // standings.matchup takes no week, so it only ever answers for the current one; weekStart is set once the header steps away from it.
  const otherWeek = weekStart !== undefined;
  const matchup = useQuery(socialApi.standings.matchup, leagueId && !otherWeek ? { leagueId } : "skip");

  if (otherWeek) return <ScreenState message={`Matchups are only shown for the current week (Week ${league?.week.number}).`} />;
  if (matchup === undefined) return <ScreenState loading />;
  if (matchup === null) return <ScreenState message="No matchup this week" />;

  return (
    <ScrollView>
      <TeamHeaders me={matchup.me} opponent={matchup.opponent} />
      <WinProbabilityBar mine={matchup.me.winProbability} theirs={matchup.opponent.winProbability} />
      <SectionLabel left="Matchup" />
      {/* A player can have several flex rows, so the slot alone is not a unique key. */}
      {matchup.rows.map((row, index) => (
        <SlotRow key={`${row.slot}-${index}`} row={row} />
      ))}
    </ScrollView>
  );
}
