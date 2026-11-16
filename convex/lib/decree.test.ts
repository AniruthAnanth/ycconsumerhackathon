import { describe, expect, it } from "vitest";

import { cleanDecreeText, statsHash, unmentionedStats, type DecreeStats } from "./decree";

const stats: DecreeStats = {
  name: "Aniruth",
  seasonPoints: 412,
  wins: 5,
  losses: 3,
  streakDays: 4,
  bestSlot: "body",
  weakestSlot: "chores",
  proofsVerified: 27,
  vetoesCast: 2,
  vetoesSuffered: 1,
  escrowUsd: 12.5,
  leagues: 2,
  rank: 3,
  rankOf: 8,
};

describe("statsHash", () => {
  it("is stable for the same stats and changes when any stat moves", () => {
    expect(statsHash({ ...stats })).toBe(statsHash(stats));
    expect(statsHash({ ...stats, proofsVerified: 28 })).not.toBe(statsHash(stats));
    expect(statsHash({ ...stats, rank: null })).not.toBe(statsHash(stats));
  });
});

describe("cleanDecreeText", () => {
  it("strips dashes, extra spaces and wrapping quotes", () => {
    expect(cleanDecreeText('"Hear ye \u2014 hear  ye"')).toBe("Hear ye, hear ye");
  });
});

describe("unmentionedStats", () => {
  it("lists every stat when the text names none", () => {
    expect(unmentionedStats("Hear ye, a player exists.", stats).map((s) => s.label)).toEqual([
      "Season points",
      "Record",
      "Streak",
      "Best slot",
      "Weakest slot",
      "Proofs",
      "Vetoes",
      "Escrow",
      "Leagues",
      "Rank",
    ]);
  });

  it("drops the stats the text already states", () => {
    const text =
      "Hear ye! Aniruth hath 412 points, 5 wins and 3 losses, a 4 day streak, mighty in Body yet feeble at chores, " +
      "27 proofs verified, $12.50 in escrow, and sits 3rd.";
    expect(unmentionedStats(text, stats)).toEqual([
      { label: "Vetoes", value: "2 cast, 1 taken" },
      { label: "Leagues", value: "2" },
    ]);
  });

  it("counts a missing slot as nothing to report", () => {
    const labels = unmentionedStats("", { ...stats, bestSlot: null, weakestSlot: null }).map((s) => s.label);
    expect(labels).not.toContain("Best slot");
    expect(labels).not.toContain("Weakest slot");
  });
});
