import { SectionLabel } from "@/components/ui";

import type { Matchup } from "../contract";
import { SlotRow } from "./SlotRow";
import { TeamHeaders } from "./TeamHeaders";
import { WinProbabilityBar } from "./WinProbabilityBar";

/** The head-to-head itself, shared by the Matchup tab and a versus's home. */
export function MatchupBody({ matchup }: { matchup: Matchup }) {
  return (
    <>
      <TeamHeaders me={matchup.me} opponent={matchup.opponent} />
      <WinProbabilityBar mine={matchup.me.winProbability} theirs={matchup.opponent.winProbability} />
      <SectionLabel left="Matchup" />
      {/* A player can have several flex rows, so the slot alone is not a unique key. */}
      {matchup.rows.map((row, index) => (
        <SlotRow key={`${row.slot}-${index}`} row={row} />
      ))}
    </>
  );
}
