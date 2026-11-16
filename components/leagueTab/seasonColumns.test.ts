import { describe, expect, test } from "vitest";

import { playoffSpots, seasonRecords } from "./seasonColumns";

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
});
