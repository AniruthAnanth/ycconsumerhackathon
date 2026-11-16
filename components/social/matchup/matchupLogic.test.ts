import { describe, expect, it } from "vitest";

import { bonusPoints, formatRecord, possiblePoints, shortName, slotLeader, statusDot, statusLine, winBarSplit } from "./matchupLogic";

describe("winBarSplit", () => {
  it("sizes the bar by probability and rounds labels to sum to 100", () => {
    expect(winBarSplit(0.62, 0.38)).toEqual({ mineShare: 0.62, minePercent: 62, theirsPercent: 38 });
    expect(winBarSplit(1 / 3, 2 / 3)).toMatchObject({ minePercent: 33, theirsPercent: 67 });
    expect(winBarSplit(0.505, 0.495)).toMatchObject({ minePercent: 51, theirsPercent: 49 });
  });

  it("clamps each side to 0..1", () => {
    expect(winBarSplit(1.5, -0.2)).toEqual({ mineShare: 1, minePercent: 100, theirsPercent: 0 });
  });

  it("falls back to 50/50 when both are 0 or not finite", () => {
    const even = { mineShare: 0.5, minePercent: 50, theirsPercent: 50 };
    expect(winBarSplit(0, 0)).toEqual(even);
    expect(winBarSplit(Number.NaN, Number.POSITIVE_INFINITY)).toEqual(even);
    expect(winBarSplit(Number.NaN, 0.4)).toEqual({ mineShare: 0, minePercent: 0, theirsPercent: 100 });
    expect(winBarSplit(Number.NaN, Number.NaN)).toEqual(even);
  });
});

describe("statusLine", () => {
  const task = { status: "open", dueLabel: "Due Thu", verifiedAt: undefined } as const;

  it("says Verified without a clock time, which truncated beside the score", () => {
    expect(statusLine({ ...task, status: "verified" })).toBe("Verified");
  });

  it("shows the due label while open", () => {
    // The section header carries the shared due day, so a row says nothing while open.
    expect(statusLine(task)).toBeUndefined();
  });

  it("flags held and failed tasks", () => {
    expect(statusLine({ ...task, status: "held" })).toBe("Reviewing");
    expect(statusLine({ ...task, status: "failed" })).toBe("Not verified");
  });
});

describe("possiblePoints", () => {
  const rows = [
    { mine: { points: 30, status: "verified" as const }, theirs: { points: 20, status: "open" as const } },
    { mine: { points: 20, status: "open" as const }, theirs: { points: 10, status: "failed" as const } },
    { mine: { points: 10, status: "held" as const } },
  ];

  it("adds only open rows to what is banked", () => {
    expect(possiblePoints(rows, "mine", 30)).toBe(50);
    expect(possiblePoints(rows, "theirs", 0)).toBe(20);
  });

  it("never reads below the banked total, even when bonuses push it past the rows", () => {
    expect(possiblePoints(rows, "mine", 150)).toBeGreaterThanOrEqual(150);
  });
});

describe("bonusPoints", () => {
  it("is what the total holds beyond the scores on the rows", () => {
    const rows = [{ mine: { score: 30 }, theirs: { score: null } }, { mine: { score: 20 } }, { mine: { score: 20 } }];
    expect(bonusPoints(rows, "mine", 150)).toBe(80);
    expect(bonusPoints(rows, "theirs", 0)).toBe(0);
  });
});

describe("slotLeader", () => {
  it("leads on the higher score and ties to nobody", () => {
    expect(slotLeader({ mine: { score: 10 }, theirs: { score: 5 } })).toBe("mine");
    expect(slotLeader({ mine: { score: null }, theirs: { score: 5 } })).toBe("theirs");
    expect(slotLeader({ mine: { score: null }, theirs: undefined })).toBeNull();
    expect(slotLeader({ mine: { score: 4 }, theirs: { score: 4 } })).toBeNull();
  });
});

describe("statusDot", () => {
  it("maps verified to done, held to pending and the rest to open", () => {
    expect(statusDot("verified")).toBe("done");
    expect(statusDot("held")).toBe("pending");
    expect(statusDot("open")).toBe("open");
    expect(statusDot("failed")).toBe("open");
  });
});

describe("formatRecord", () => {
  it("prints ties only when there are some", () => {
    expect(formatRecord({ wins: 3, losses: 1, ties: 0 })).toBe("3-1");
    expect(formatRecord({ wins: 2, losses: 1, ties: 1 })).toBe("2-1-1");
  });
});

describe("shortName", () => {
  it("keeps the first name", () => {
    expect(shortName("Ada Lovelace")).toBe("Ada");
    expect(shortName("Sunny")).toBe("Sunny");
  });
});
