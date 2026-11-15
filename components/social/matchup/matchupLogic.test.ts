import { describe, expect, it } from "vitest";

import { statusLine, winBarSplit } from "./matchupLogic";

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

  it("shows when a verified task was verified", () => {
    const verifiedAt = new Date(2026, 10, 15, 14, 14).getTime();
    expect(statusLine({ ...task, status: "verified", verifiedAt })).toBe("Verified 2:14 PM");
  });

  it("shows the due label while open", () => {
    expect(statusLine(task)).toBe("Due Thu");
  });

  it("flags held and failed tasks", () => {
    expect(statusLine({ ...task, status: "held" })).toBe("Under review");
    expect(statusLine({ ...task, status: "failed" })).toBe("Not verified");
  });
});
