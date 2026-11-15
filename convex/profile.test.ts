import { describe, expect, it } from "vitest";

import { bestSlot, calendarDay, completionRate, fastestResponseSec, pointsByWeek, streaks } from "./profile";

const DAY = 24 * 60 * 60 * 1000;
// Monday 9 Nov 2026 00:00 in Los Angeles (PST, UTC-8).
const WEEK = Date.UTC(2026, 10, 9, 8);

describe("completionRate", () => {
  it("is the share of tasks that are verified", () => {
    const tasks = [{ status: "verified" }, { status: "open" }, { status: "failed" }, { status: "verified" }] as const;
    expect(completionRate([...tasks])).toBe(0.5);
  });
  it("does not count a held task: its proof is under challenge", () => {
    expect(completionRate([{ status: "held" }, { status: "verified" }])).toBe(0.5);
  });
  it("is 0 for a player with no tasks", () => {
    expect(completionRate([])).toBe(0);
  });
});

describe("bestSlot", () => {
  it("picks the slot cleared most often", () => {
    expect(
      bestSlot([
        { slot: "body", status: "verified", points: 20 },
        { slot: "body", status: "verified", points: 20 },
        { slot: "mind", status: "verified", points: 50 },
        { slot: "chores", status: "open", points: 50 },
      ]),
    ).toBe("body");
  });
  it("breaks a tie by points earned", () => {
    expect(
      bestSlot([
        { slot: "body", status: "verified", points: 20 },
        { slot: "mind", status: "verified", points: 40 },
      ]),
    ).toBe("mind");
  });
  it("lets flex win only when nothing else is done", () => {
    const flex = { slot: "flex", status: "verified", points: 50 } as const;
    expect(bestSlot([flex, flex, { slot: "people", status: "verified", points: 10 }])).toBe("people");
    expect(bestSlot([flex])).toBe("flex");
  });
  it("is null before the first verified task", () => {
    expect(bestSlot([{ slot: "body", status: "open", points: 20 }])).toBeNull();
  });
});

describe("calendarDay", () => {
  it("gives consecutive numbers to consecutive Los Angeles days", () => {
    const monday = calendarDay(WEEK + 10 * 60 * 60 * 1000, WEEK);
    expect(calendarDay(WEEK + DAY - 1, WEEK)).toBe(monday);
    expect(calendarDay(WEEK + DAY, WEEK)).toBe(monday + 1);
    expect(calendarDay(WEEK + 6 * DAY + 1, WEEK)).toBe(monday + 6);
  });
  it("continues across weeks, so Sunday and the next Monday are neighbours", () => {
    const sunday = calendarDay(WEEK + 6.5 * DAY, WEEK);
    const nextMonday = calendarDay(WEEK + 7.5 * DAY, WEEK + 7 * DAY);
    expect(nextMonday).toBe(sunday + 1);
  });
  it("stays consecutive across the daylight-saving change", () => {
    // Monday 26 Oct 2026 is still PDT (UTC-7); Monday 2 Nov 2026 is PST (UTC-8).
    const pdtWeek = Date.UTC(2026, 9, 26, 7);
    const pstWeek = Date.UTC(2026, 10, 2, 8);
    expect(calendarDay(pstWeek + 1, pstWeek)).toBe(calendarDay(pdtWeek + 1, pdtWeek) + 7);
  });
});

describe("streaks", () => {
  it("counts the run that ends today", () => {
    expect(streaks([10, 11, 12], 12)).toEqual({ current: 3, longest: 3 });
  });
  it("keeps the streak alive when the last proof was yesterday", () => {
    expect(streaks([10, 11], 12)).toEqual({ current: 2, longest: 2 });
  });
  it("ends the current streak after a missed day, but remembers the longest", () => {
    expect(streaks([1, 2, 3, 4, 8], 10)).toEqual({ current: 0, longest: 4 });
  });
  it("counts a day once however many proofs it has", () => {
    expect(streaks([5, 5, 5, 6], 6)).toEqual({ current: 2, longest: 2 });
  });
  it("is zero with no proofs", () => {
    expect(streaks([], 6)).toEqual({ current: 0, longest: 0 });
  });
});

describe("pointsByWeek", () => {
  it("sums verified tasks per week", () => {
    const byWeek = pointsByWeek([
      { weekStart: 1, slot: "body", status: "verified", points: 30 },
      { weekStart: 1, slot: "mind", status: "verified", points: 20 },
      { weekStart: 1, slot: "chores", status: "held", points: 50 },
      { weekStart: 2, slot: "body", status: "verified", points: 10 },
    ]);
    expect([...byWeek.entries()]).toEqual([
      [1, 50],
      [2, 10],
    ]);
  });
});

describe("fastestResponseSec", () => {
  it("is the quickest gap between a drop opening and its proof", () => {
    expect(
      fastestResponseSec([
        { opensAt: 1_000, provedAt: 91_000 },
        { opensAt: 5_000, provedAt: 47_400 },
      ]),
    ).toBe(42);
  });
  it("is undefined for a player who never answered a drop", () => {
    expect(fastestResponseSec([])).toBeUndefined();
  });
});
