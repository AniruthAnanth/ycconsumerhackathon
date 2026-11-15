/** What the pot card says when there is no money in it yet, or null once it has something to draw. */
export function potEmptyText(pot: { stakeUsd: number; potUsd: number }): string | null {
  if (pot.stakeUsd === 0) return "Free league: no pot";
  return pot.potUsd === 0 ? "The pot fills as players pay in" : null;
}

/**
 * A standings row's second line. A bare "0/5 slots" for someone who has not drafted reads like a
 * bug, so a row with nothing cleared and no points asks for a lineup instead.
 */
export function slotsText(row: { slotsCleared: number; points: number; paid: boolean }): string {
  if (!row.paid) return "Unpaid";
  if (row.slotsCleared === 0 && row.points === 0) return "Draft your lineup to fill your 5 slots";
  return `${row.slotsCleared}/5 slots`;
}
