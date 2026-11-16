/** What the pot card says when there is no money in it yet, or null once it has something to draw. */
export function potEmptyText(pot: { stakeUsd: number; potUsd: number }): string | null {
  if (pot.stakeUsd === 0) return "Free league: no pot";
  return pot.potUsd === 0 ? "The pot fills as players pay in" : null;
}

/** A standings row's second line: short, so it stays on one line under the name. */
export function slotsText(row: { slotsCleared: number; paid: boolean }): string {
  if (!row.paid) return "Unpaid";
  return `${row.slotsCleared} of 5 slots`;
}
