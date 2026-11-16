import type { ReactNode } from "react";

import { CoachTarget } from "@/components/coach";
import { Entrance } from "@/components/motion";
import { SectionLabel } from "@/components/ui";
import { sharedDueLabel } from "@/lib/roster";

import type { Id } from "@/convex/_generated/dataModel";

import type { Matchup, TaskVeto } from "../contract";
import { BonusRow } from "./BonusRow";
import { MatchupHero } from "./MatchupHero";
import { SlotRow } from "./SlotRow";

/** The head-to-head itself, shared by the Matchup tab and a versus's home. */
export function MatchupBody({
  matchup,
  belowHero,
  vetoes,
  bonus = true,
}: {
  matchup: Matchup;
  belowHero?: ReactNode;
  /** The Matchup tab moves the bonus line into its More section; a versus keeps it under the rows. */
  bonus?: boolean;
  vetoes?: { byTask: Map<Id<"tasks">, TaskVeto>; leagueId: Id<"leagues"> };
}) {
  return (
    <>
      <Entrance>
        <MatchupHero matchup={matchup} />
      </Entrance>
      {/* Mount point right under the hero; empty unless a caller passes something. */}
      {belowHero}
      <SectionLabel left="Matchup" right={sharedDueLabel(matchup.rows.flatMap((row) => [row.mine, row.theirs]).filter((task) => task !== undefined))} />
      {/* A player can have several flex rows, so the slot alone is not a unique key. */}
      <CoachTarget id="slots">
        {matchup.rows.map((row, index) => (
          <Entrance key={`${row.slot}-${index}`} index={index + 1}>
            <SlotRow row={row} vetoes={vetoes} />
          </Entrance>
        ))}
      </CoachTarget>
      {bonus ? <BonusRow matchup={matchup} /> : null}
    </>
  );
}
