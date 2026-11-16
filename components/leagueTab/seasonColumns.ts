/**
 * The season half of the League table. seasons.overview serves wins, losses, ties and points for,
 * but not points against, so PA is added up here from the same query's weeks: every final
 * regular-season matchup, which are exactly the games the server's table counts (playoff weeks
 * carry a round and decide the bracket, not the table).
 */

type Side = { userId: string };
type SeasonLike = {
  weeks: {
    status: "final" | "live" | "upcoming";
    round?: string;
    matchups: { a: Side; b: Side; scoreA: number | null; scoreB: number | null }[];
  }[];
  table: { userId: string; rank: number; wins: number; losses: number; ties: number; pointsFor: number }[];
  bracket: { rounds: { matches: { a: { seed: number } | null; b: { seed: number } | null }[] }[] } | null;
};

/** One player's season line: W-L-T, PF and PA. */
export type SeasonRecord = { rank: number; wins: number; losses: number; ties: number; pointsFor: number; pointsAgainst: number };

/** Season lines by player. */
export function seasonRecords(season: SeasonLike): Map<string, SeasonRecord> {
  const against = new Map<string, number>();
  for (const week of season.weeks) {
    if (week.status !== "final" || week.round !== undefined) continue;
    for (const { a, b, scoreA, scoreB } of week.matchups) {
      if (scoreA === null || scoreB === null) continue;
      against.set(a.userId, (against.get(a.userId) ?? 0) + scoreB);
      against.set(b.userId, (against.get(b.userId) ?? 0) + scoreA);
    }
  }
  return new Map(
    season.table.map((row) => [
      row.userId,
      { rank: row.rank, wins: row.wins, losses: row.losses, ties: row.ties, pointsFor: row.pointsFor, pointsAgainst: against.get(row.userId) ?? 0 },
    ]),
  );
}

/** How many make the playoffs: the highest seed in the bracket's first round, or null with no bracket. */
export function playoffSpots(season: SeasonLike): number | null {
  const first = season.bracket?.rounds[0];
  if (!first) return null;
  const seeds = first.matches.flatMap((match) => [match.a?.seed ?? 0, match.b?.seed ?? 0]);
  const spots = Math.max(0, ...seeds);
  return spots > 0 ? spots : null;
}

/**
 * The week's rows in season order, ranked by the season table, so RK, W-L, PF and the playoff line
 * agree. A player the season table doesn't list yet keeps their place after everyone it does.
 * Players level on wins and points for (the season table's own order) share a rank, and the next
 * rank skips past them: 1, 2, 2, 2, 5. The server breaks those ties by join order, which is not a
 * result, so the table and YOUR RANK both show the shared rank from here.
 */
export function bySeasonRank<Row extends { userId: string; rank: number }>(rows: Row[], records: Map<string, SeasonRecord>): Row[] {
  const rankOf = (row: Row) => records.get(row.userId)?.rank ?? Number.MAX_SAFE_INTEGER;
  const level = (x: Row, y: Row) => {
    const a = records.get(x.userId);
    const b = records.get(y.userId);
    return a !== undefined && b !== undefined && a.wins === b.wins && a.pointsFor === b.pointsFor;
  };
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => rankOf(x.row) - rankOf(y.row) || x.index - y.index)
    .map(({ row }) => row);
  const ranked: Row[] = [];
  sorted.forEach((row, index) => {
    const previous = ranked[index - 1];
    const rank = previous && level(sorted[index - 1], row) ? previous.rank : index + 1;
    ranked.push({ ...row, rank });
  });
  return ranked;
}
