type Ranked = { userId: string; rank: number };

/**
 * The rank each player had when this session first saw them. Players already in the baseline keep
 * their first rank, so movement always measures "since the table was first shown".
 */
export function withBaseline(baseline: Record<string, number>, rows: Ranked[]): Record<string, number> {
  if (rows.every((row) => row.userId in baseline)) return baseline;
  const next = { ...baseline };
  for (const row of rows) next[row.userId] ??= row.rank;
  return next;
}

/** Places gained since the baseline: positive is up the table, negative is down, 0 is no change. */
export function rankMovement(baseline: Record<string, number>, row: Ranked): number {
  return (baseline[row.userId] ?? row.rank) - row.rank;
}
