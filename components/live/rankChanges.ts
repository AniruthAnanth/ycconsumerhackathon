/**
 * The players whose rank differs from the last table this screen drew, so their rows can flash
 * as they slide. The first table has nothing to compare with, so nothing moved; a player who
 * just joined has no previous rank and did not move either.
 */
export function rankChanges(
  previous: Readonly<Record<string, number>> | undefined,
  rows: readonly { userId: string; rank: number }[],
): Set<string> {
  const moved = new Set<string>();
  if (!previous) return moved;
  for (const row of rows) {
    const before = previous[row.userId];
    if (before !== undefined && before !== row.rank) moved.add(row.userId);
  }
  return moved;
}

/** The ranks of this table, keyed by player, for the next comparison. */
export function ranksOf(rows: readonly { userId: string; rank: number }[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.userId, row.rank]));
}
