import type { ReactNode } from "react";

import { Entrance } from "@/components/motion";
import { SectionLabel } from "@/components/ui";

import type { Matchup } from "../contract";
import { MatchupHero } from "./MatchupHero";
import { SlotRow } from "./SlotRow";

/** The head-to-head itself, shared by the Matchup tab and a versus's home. */
export function MatchupBody({ matchup, belowHero }: { matchup: Matchup; belowHero?: ReactNode }) {
  return (
    <>
      <Entrance>
        <MatchupHero matchup={matchup} />
      </Entrance>
      {/* Mount point right under the hero; empty unless a caller passes something. */}
      {belowHero}
      <SectionLabel left="Matchup" />
      {/* A player can have several flex rows, so the slot alone is not a unique key. */}
      {matchup.rows.map((row, index) => (
        <Entrance key={`${row.slot}-${index}`} index={index + 1}>
          <SlotRow row={row} />
        </Entrance>
      ))}
    </>
  );
}
