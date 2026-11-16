import { describe, expect, test } from "vitest";

import { bySeasonRank, playoffSpots, seasonRecords } from "./seasonColumns";

const p = (userId: string) => ({ userId });
const season = {
  weeks: [
    { status: "final" as const, matchups: [{ a: p("a"), b: p("b"), scoreA: 100, scoreB: 80 }] },
    { status: "final" as const, matchups: [{ a: p("a"), b: p("b"), scoreA: 60, scoreB: 70 }] },
    { status: "live" as const, matchups: [{ a: p("a"), b: p("b"), scoreA: 20, scoreB: 10 }] },
    { status: "final" as const, round: "Final", matchups: [{ a: p("a"), b: p("b"), scoreA: 1, scoreB: 2 }] },
  ],
  table: [
    { userId: "b", rank: 1, wins: 1, losses: 1, ties: 0, pointsFor: 150 },
    { userId: "a", rank: 2, wins: 1, losses: 1, ties: 0, pointsFor: 160 },
  ],
  bracket: { rounds: [{ matches: [{ a: { seed: 1 }, b: { seed: 4 } }, { a: { seed: 2 }, b: { seed: 3 } }] }] },
};

describe("season columns", () => {
  test("points against add up only the final regular-season games", () => {
    const records = seasonRecords(season);
    expect(records.get("a")?.pointsAgainst).toBe(150);
    expect(records.get("b")?.pointsAgainst).toBe(160);
  });

  test("the playoff line sits under the highest first-round seed, and there is none without a bracket", () => {
    expect(playoffSpots(season)).toBe(4);
    expect(playoffSpots({ ...season, bracket: null })).toBeNull();
  });

  test("rows follow the season table and an unlisted player goes last", () => {
    const rows = [{ userId: "a", rank: 1 }, { userId: "c", rank: 2 }, { userId: "b", rank: 3 }];
    expect(bySeasonRank(rows, seasonRecords(season))).toEqual([
      { userId: "b", rank: 1 },
      { userId: "a", rank: 2 },
      { userId: "c", rank: 3 },
    ]);
  });

  test("players level on wins and points for share a rank and the next rank skips past them", () => {
    const record = (rank: number, wins: number, pointsFor: number) => ({ rank, wins, losses: 0, ties: 0, pointsFor, pointsAgainst: 0 });
    const records = new Map([
      ["a", record(1, 3, 300)],
      ["b", record(2, 2, 200)],
      ["c", record(3, 2, 200)],
      ["d", record(4, 2, 200)],
      ["e", record(5, 1, 100)],
    ]);
    const rows = ["e", "d", "c", "b", "a", "f"].map((userId) => ({ userId, rank: 0 }));
    expect(bySeasonRank(rows, records).map((row) => [row.userId, row.rank])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 2],
      ["d", 2],
      ["e", 5],
      ["f", 6],
    ]);
  });
});
