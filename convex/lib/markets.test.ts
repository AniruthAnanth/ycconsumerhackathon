import { describe, expect, test } from "vitest";

import {
  completionRate,
  deltaSince,
  normalCdf,
  PRIOR_COMPLETION_RATE,
  projectScore,
  remainingChance,
  thin,
  topChances,
  winChance,
} from "./markets";

const fixed = (confirmed: number) => projectScore({ confirmed, openValues: [], chance: 0 });

describe("completionRate", () => {
  test("starts at the prior and moves toward the player's record", () => {
    expect(completionRate(0, 0)).toBe(PRIOR_COMPLETION_RATE);
    expect(completionRate(10, 10)).toBeCloseTo(13 / 15);
    expect(completionRate(0, 10)).toBeCloseTo(3 / 15);
    expect(completionRate(190, 200)).toBeGreaterThan(0.9);
  });
});

describe("remainingChance", () => {
  test("is the whole rate at the start of the week and nothing at its end", () => {
    expect(remainingChance(0.8, 1)).toBeCloseTo(0.8);
    expect(remainingChance(0.8, 0)).toBe(0);
    expect(remainingChance(0, 0.5)).toBe(0);
  });

  test("is the Bayes share of the tasks still to come", () => {
    // Half the week left at a 60% rate: 0.3 of tasks are still to come out of the 0.7 not yet done.
    expect(remainingChance(0.6, 0.5)).toBeCloseTo(0.3 / 0.7);
    expect(remainingChance(1, 0.25)).toBe(1);
  });

  test("clamps nonsense inputs", () => {
    expect(remainingChance(2, 2)).toBe(1);
    expect(remainingChance(Number.NaN, 0.5)).toBe(0);
  });
});

describe("projectScore", () => {
  test("adds the expected value of each open task and an 80% band", () => {
    const projection = projectScore({ confirmed: 100, openValues: [50, 50], chance: 0.5 });
    expect(projection.mean).toBe(150);
    expect(projection.sd).toBeCloseTo(Math.sqrt(2 * 0.25 * 2500));
    expect(projection.low).toBe(Math.round(150 - 1.2816 * projection.sd));
    expect(projection.high).toBe(Math.round(150 + 1.2816 * projection.sd));
  });

  test("never ranges below what is banked or above every open task landing", () => {
    const projection = projectScore({ confirmed: 100, openValues: [40], chance: 0.9 });
    expect(projection.low).toBeGreaterThanOrEqual(100);
    expect(projection.high).toBeLessThanOrEqual(140);
  });

  test("has no spread with nothing open", () => {
    expect(fixed(80)).toEqual({ confirmed: 80, mean: 80, sd: 0, low: 80, high: 80 });
  });
});

describe("normalCdf", () => {
  test("matches the standard table", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1)).toBeCloseTo(0.841345, 5);
    expect(normalCdf(-1.96)).toBeCloseTo(0.024998, 5);
    expect(normalCdf(1.2816)).toBeCloseTo(0.9, 4);
  });
});

describe("winChance", () => {
  test("is even for equal players and sums to one across the pair", () => {
    const a = projectScore({ confirmed: 100, openValues: [30, 30], chance: 0.6 });
    const b = projectScore({ confirmed: 120, openValues: [20], chance: 0.6 });
    expect(winChance(a, a)).toBeCloseTo(0.5);
    expect(winChance(a, b) + winChance(b, a)).toBeCloseTo(1);
  });

  test("is one CDF of the mean gap over the combined spread", () => {
    const a = projectScore({ confirmed: 150, openValues: [40], chance: 0.5 });
    const b = projectScore({ confirmed: 140, openValues: [40], chance: 0.5 });
    expect(winChance(a, b)).toBeCloseTo(normalCdf(10 / Math.hypot(a.sd, b.sd)), 6);
  });

  test("is all but certain once the trailer can't catch up, and a coin flip on a dead tie", () => {
    expect(winChance(fixed(200), fixed(100))).toBeGreaterThan(0.999);
    expect(winChance(fixed(100), fixed(100))).toBeCloseTo(0.5, 6);
  });
});

describe("topChances", () => {
  test("splits a field of equals evenly and always sums to one", () => {
    const even = topChances([fixed(10), fixed(10), fixed(10), fixed(10)]);
    even.forEach((chance) => expect(chance).toBeCloseTo(0.25, 2));
    const mixed = topChances([
      projectScore({ confirmed: 200, openValues: [50], chance: 0.5 }),
      projectScore({ confirmed: 180, openValues: [50, 50], chance: 0.5 }),
      fixed(40),
    ]);
    expect(mixed.reduce((sum, chance) => sum + chance, 0)).toBeCloseTo(1, 9);
    expect(mixed[2]).toBeLessThan(0.001);
  });

  test("agrees with winChance for two players", () => {
    const a = projectScore({ confirmed: 150, openValues: [40, 20], chance: 0.5 });
    const b = projectScore({ confirmed: 140, openValues: [40], chance: 0.7 });
    expect(topChances([a, b])[0]).toBeCloseTo(winChance(a, b), 2);
  });

  test("handles the trivial fields", () => {
    expect(topChances([])).toEqual([]);
    expect(topChances([fixed(5)])).toEqual([1]);
  });
});

describe("deltaSince", () => {
  const history = [
    { at: 0, chance: 0.5 },
    { at: 10, chance: 0.48 },
    { at: 20, chance: 0.55 },
    { at: 30, chance: 0.62 },
  ];
  test("compares the latest point with the last one before the day began", () => {
    expect(deltaSince(history, 15)).toBe(14);
    expect(deltaSince(history, 25)).toBe(7);
  });
  test("falls back to the week's opening point, and to zero with no history", () => {
    expect(deltaSince(history, -1)).toBe(12);
    expect(deltaSince([], 0)).toBe(0);
  });
});

describe("thin", () => {
  test("keeps both ends and an even spread", () => {
    expect(thin([1, 2, 3], 5)).toEqual([1, 2, 3]);
    expect(thin([0, 1, 2, 3, 4, 5, 6, 7, 8], 3)).toEqual([0, 4, 8]);
  });
});
