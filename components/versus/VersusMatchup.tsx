import { useQuery } from "convex/react";
import { ScrollView } from "react-native";

import { socialApi } from "@/components/social/contract";
import { SlotRow } from "@/components/social/matchup/SlotRow";
import { TeamHeaders } from "@/components/social/matchup/TeamHeaders";
import { WinProbabilityBar } from "@/components/social/matchup/WinProbabilityBar";
import { SectionLabel } from "@/components/ui";

import type { Versus } from "./api";
import { VersusPot } from "./VersusPot";

/**
 * A versus is a two-member league, so its matchup is the ordinary one with the
 * pot on top. Until the friend accepts there is no matchup, and the pot panel
 * (code and Share) is the whole screen.
 */
export function VersusMatchup({ versus }: { versus: Versus }) {
  const matchup = useQuery(socialApi.standings.matchup, { leagueId: versus.leagueId });
  return (
    <ScrollView>
      <VersusPot versus={versus} />
      {matchup ? (
        <>
          <TeamHeaders me={matchup.me} opponent={matchup.opponent} />
          <WinProbabilityBar mine={matchup.me.winProbability} theirs={matchup.opponent.winProbability} />
          <SectionLabel left="Matchup" />
          {matchup.rows.map((row, index) => (
            <SlotRow key={`${row.slot}-${index}`} row={row} />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
