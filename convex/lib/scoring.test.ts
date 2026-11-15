import { describe, expect, test } from "vitest";

import {
  type ScorableTask,
  clampTaskPoints,
  clampWager,
  clearedSlots,
  currentStreak,
  groupSessionScore,
  longestStreak,
  matchupBonus,
  mysteryScore,
  quickTimeScore,
  scoreWeek,
  slotBonus,
  streakBonus,
  taskScore,
  winProbability,
} from "./scoring";

const task = (overrides: Partial<ScorableTask> = {}): ScorableTask => ({
  slot: "body",
  points: 30,
  status: "verified",
  source: "draft",
  ...overrides,
});

describe("task points", () => {
  test("a task is worth 10 to 50 whole points", () => {
    expect(clampTaskPoints(5)).toBe(10);
    expect(clampTaskPoints(80)).toBe(50);
    expect(clampTaskPoints(32.6)).toBe(33);
    expect(clampTaskPoints(Number.NaN)).toBe(10);
  });

  test("only a verified task pays", () => {
    expect(taskScore(task())).toBe(30);
    expect(taskScore(task({ status: "open" }))).toBeNull();
    expect(taskScore(task({ status: "held" }))).toBeNull();
    expect(taskScore(task({ status: "failed" }))).toBeNull();
  });

  test("a failed mystery task costs the penalty it carries", () => {
    expect(taskScore(task({ source: "mystery", status: "failed", points: -50 }))).toBe(-50);
  });
});

describe("bonus formulas", () => {
  test("a quick-time drop pays its points, plus 10 to the first finisher", () => {
    expect(quickTimeScore(40, false)).toBe(40);
    expect(quickTimeScore(40, true)).toBe(50);
  });

  test("a mystery task pays double, or costs 20, with the wager riding on it", () => {
    expect(mysteryScore(30, 0, true)).toBe(60);
    expect(mysteryScore(30, 0, false)).toBe(-20);
    expect(mysteryScore(30, 25, true)).toBe(85);
    expect(mysteryScore(30, 25, false)).toBe(-45);
  });

  test("a wager is at most 50 and never more than the player has", () => {
    expect(clampWager(30, 200)).toBe(30);
    expect(clampWager(80, 200)).toBe(50);
    expect(clampWager(30, 12)).toBe(12);
    expect(clampWager(-5, 200)).toBe(0);
    expect(clampWager(30, -40)).toBe(0);
  });

  test("a group session pays 5 per other attendee, capped at 25", () => {
    expect(groupSessionScore(30, 0)).toBe(30);
    expect(groupSessionScore(30, 3)).toBe(45);
    expect(groupSessionScore(30, 9)).toBe(55);
  });
});

describe("slots", () => {
  test("a verified drafted task clears its slot", () => {
    const tasks = [task({ slot: "body" }), task({ slot: "mind", status: "open" }), task({ slot: "people" })];
    expect(clearedSlots(tasks)).toEqual(["body", "people"]);
  });

  test("bonus tasks never clear a slot, because slots decide the stake", () => {
    const tasks = [
      task({ slot: "body", source: "drop" }),
      task({ slot: "mind", source: "mystery" }),
      task({ slot: "flex", source: "flex" }),
      task({ slot: "flex", source: "draft" }),
    ];
    expect(clearedSlots(tasks)).toEqual([]);
  });

  test("a group session counts for both Body and People", () => {
    expect(clearedSlots([task({ slot: "body", source: "group" })])).toEqual(["body", "people"]);
    expect(clearedSlots([task({ slot: "body", source: "group", status: "open" })])).toEqual([]);
  });

  test("+25 a slot and +100 for the sweep", () => {
    expect(slotBonus(0)).toBe(0);
    expect(slotBonus(3)).toBe(75);
    expect(slotBonus(4)).toBe(100);
    expect(slotBonus(5)).toBe(225);
  });
});

describe("streaks", () => {
  test("day n of a run pays 5n, capped at 25", () => {
    expect(streakBonus([])).toBe(0);
    expect(streakBonus([10])).toBe(5);
    expect(streakBonus([10, 11, 12])).toBe(30);
    expect(streakBonus([10, 11, 12, 13, 14, 15, 16])).toBe(5 + 10 + 15 + 20 + 25 + 25 + 25);
  });

  test("a gap starts the run again, and two proofs in a day count once", () => {
    expect(streakBonus([10, 11, 13])).toBe(5 + 10 + 5);
    expect(streakBonus([12, 10, 10, 11])).toBe(30);
  });

  test("the current streak survives until a whole day is missed", () => {
    expect(currentStreak([10, 11, 12], 12)).toBe(3);
    expect(currentStreak([10, 11, 12], 13)).toBe(3);
    expect(currentStreak([10, 11, 12], 14)).toBe(0);
    expect(currentStreak([], 14)).toBe(0);
    expect(longestStreak([1, 2, 3, 7, 8])).toBe(3);
  });
});

describe("scoreWeek", () => {
  test("adds task points, slot bonuses and the streak", () => {
    const tasks = [
      task({ slot: "body", points: 40 }),
      task({ slot: "mind", points: 45 }),
      task({ slot: "recharge", points: 20, status: "open" }),
      task({ slot: "body", points: 50, source: "drop" }),
      task({ slot: "body", points: -20, source: "mystery", status: "failed" }),
    ];
    expect(scoreWeek(tasks, [3, 4])).toEqual({
      taskPoints: 115,
      slotsCleared: 2,
      slotBonus: 50,
      streakBonus: 15,
      total: 180,
      finisher: false,
    });
  });

  test("a sweep makes a finisher", () => {
    const sweep = (["body", "mind", "recharge", "chores", "people"] as const).map((slot) =>
      task({ slot, points: 10 }),
    );
    const score = scoreWeek(sweep, []);
    expect(score.finisher).toBe(true);
    expect(score.total).toBe(50 + 125 + 100);
  });
});

describe("matchups", () => {
  test("the higher scorer takes +50 and a tie pays nobody", () => {
    expect(matchupBonus(120, 90)).toBe(50);
    expect(matchupBonus(90, 120)).toBe(0);
    expect(matchupBonus(90, 90)).toBe(0);
  });

  test("win probability follows the projected totals", () => {
    expect(winProbability({ total: 0, openPoints: 0 }, { total: 0, openPoints: 0 })).toBe(0.5);
    expect(winProbability({ total: 100, openPoints: 0 }, { total: 100, openPoints: 0 })).toBe(0.5);
    expect(winProbability({ total: 300, openPoints: 0 }, { total: 100, openPoints: 0 })).toBe(0.75);
    expect(winProbability({ total: 100, openPoints: 100 }, { total: 100, openPoints: 0 })).toBe(0.6);
    expect(winProbability({ total: 500, openPoints: 0 }, { total: 0, openPoints: 0 })).toBe(0.99);
  });

  test("the two sides add up to one", () => {
    const mine = { total: 295, openPoints: 20 };
    const theirs = { total: 500, openPoints: 0 };
    expect(winProbability(mine, theirs) + winProbability(theirs, mine)).toBeCloseTo(1);
  });
});
