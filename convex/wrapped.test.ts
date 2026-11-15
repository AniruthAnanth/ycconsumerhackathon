import { describe, expect, it } from "vitest";

import {
  bestProof,
  biggestComeback,
  buildCards,
  fastestQuickTime,
  formatDuration,
  ordinal,
  pickWeek,
  type Entry,
} from "./wrapped";

const DAY = 24 * 60 * 60 * 1000;
const WEEK = Date.UTC(2026, 10, 9, 8); // Monday 00:00 in Los Angeles

function entry(overrides: Partial<Entry>): Entry {
  return {
    userId: "maya",
    name: "Maya",
    taskTitle: "Leg day",
    points: 30,
    provedAt: WEEK + 1000,
    highlight: 5,
    confidence: 0.9,
    caption: "Squat rack conquered",
    ...overrides,
  };
}

describe("bestProof", () => {
  it("picks the highest highlight", () => {
    const top = entry({ highlight: 9, caption: "Summit selfie" });
    expect(bestProof([entry({ highlight: 4 }), top, entry({ highlight: 7 })])).toBe(top);
  });
  it("breaks a tie on the referee's confidence", () => {
    const sure = entry({ highlight: 8, confidence: 0.97 });
    expect(bestProof([entry({ highlight: 8, confidence: 0.7 }), sure])).toBe(sure);
  });
  it("is null with no proofs", () => {
    expect(bestProof([])).toBeNull();
  });
});

describe("fastestQuickTime", () => {
  it("finds the quickest answer to a drop and ignores ordinary proofs", () => {
    const slow = entry({ quickTime: { title: "20 push-ups", opensAt: WEEK }, provedAt: WEEK + 300_000 });
    const fast = entry({ userId: "sam", quickTime: { title: "20 push-ups", opensAt: WEEK }, provedAt: WEEK + 42_000 });
    expect(fastestQuickTime([entry({}), slow, fast])).toEqual({ entry: fast, seconds: 42 });
  });
  it("is null when nobody answered a drop", () => {
    expect(fastestQuickTime([entry({})])).toBeNull();
  });
});

describe("biggestComeback", () => {
  const members = ["maya", "sam", "lee"];
  it("finds the member who climbed furthest from their worst day", () => {
    const scores = [
      { userId: "maya", points: 50, provedAt: WEEK + 1 }, // Monday: Maya leads, Lee is 2nd level with Sam
      { userId: "sam", points: 30, provedAt: WEEK + DAY + 1 }, // Tuesday: Lee drops to 3rd
      { userId: "lee", points: 90, provedAt: WEEK + 3 * DAY + 1 }, // Thursday: Lee takes the lead
    ];
    expect(biggestComeback(scores, members, WEEK)).toEqual({ userId: "lee", from: 3, to: 1 });
  });
  it("is null when the order never changed", () => {
    const scores = [
      { userId: "maya", points: 50, provedAt: WEEK + 1 },
      { userId: "maya", points: 20, provedAt: WEEK + 2 * DAY },
    ];
    expect(biggestComeback(scores, members, WEEK)).toBeNull();
  });
  it("is null before anyone has scored", () => {
    expect(biggestComeback([], members, WEEK)).toBeNull();
  });
});

describe("formatting", () => {
  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "103rd",
    ]);
  });
  it("writes durations short", () => {
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(185)).toBe("3m 05s");
    expect(formatDuration(4320)).toBe("1h 12m");
  });
});

describe("pickWeek", () => {
  const weeks = [
    { number: 1, status: "settled" },
    { number: 2, status: "settled" },
    { number: 3, status: "open" },
  ] as const;
  it("returns the week asked for", () => {
    expect(pickWeek([...weeks], 1)?.number).toBe(1);
    expect(pickWeek([...weeks], 9)).toBeNull();
  });
  it("defaults to the latest settled week", () => {
    expect(pickWeek([...weeks])?.number).toBe(2);
  });
  it("falls back to the week in progress before the first settlement", () => {
    expect(pickWeek([{ number: 1, status: "open" }])?.number).toBe(1);
  });
});

describe("buildCards", () => {
  const standings = [
    { userId: "maya", name: "Maya", points: 80, slotsCleared: 2 },
    { userId: "sam", name: "Sam", points: 120, slotsCleared: 4 },
    { userId: "lee", name: "Lee", points: 0, slotsCleared: 0 },
  ];
  const entries = [
    entry({ userId: "maya", name: "Maya", points: 50, highlight: 6, provedAt: WEEK + 1 }),
    entry({ userId: "maya", name: "Maya", points: 30, highlight: 3, provedAt: WEEK + DAY + 1 }),
    entry({
      userId: "sam", name: "Sam", points: 120, highlight: 9, caption: "Three fingers up, mid push-up",
      provedAt: WEEK + 2 * DAY + 42_000, quickTime: { title: "20 push-ups", opensAt: WEEK + 2 * DAY },
    }),
  ];

  it("returns the five cards in story order", () => {
    const cards = buildCards({ standings, entries, viewerId: "maya", weekStart: WEEK });
    expect(cards.map((card) => card.kind)).toEqual(["champion", "best_proof", "comeback", "fastest", "your_week"]);
    expect(cards[0]).toMatchObject({ subtitle: "Sam · 40 ahead of Maya", stat: "120 pts" });
    expect(cards[1]).toMatchObject({ subtitle: "Sam · Three fingers up, mid push-up", stat: "9/10" });
    expect(cards[2]).toMatchObject({ subtitle: "Sam climbed from 2nd to 1st", stat: "+1" });
    expect(cards[3]).toMatchObject({ subtitle: "Sam · 20 push-ups", stat: "42s" });
    expect(cards[4]).toMatchObject({ subtitle: "2/5 slots · 2 proofs", stat: "80 pts" });
  });

  it("still returns five honest cards for a week with no proofs", () => {
    const empty = standings.map((s) => ({ ...s, points: 0, slotsCleared: 0 }));
    const cards = buildCards({ standings: empty, entries: [], viewerId: "lee", weekStart: WEEK });
    expect(cards).toHaveLength(5);
    expect(cards.slice(0, 4).every((card) => card.stat === "—")).toBe(true);
    expect(cards[4]).toMatchObject({ subtitle: "0/5 slots · 0 proofs", stat: "0 pts" });
  });
});
