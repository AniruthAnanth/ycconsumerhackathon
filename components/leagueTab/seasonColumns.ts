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
