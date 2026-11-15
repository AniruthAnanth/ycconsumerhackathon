import { describe, expect, it } from "vitest";

import { planProgress, planProgressLabel } from "./weeklyPlan";

describe("planProgress", () => {
  it("fills only from verified scores and keeps held points apart", () => {
    const progress = planProgress([
      { points: 30, status: "verified", score: 30 },
      { points: 30, status: "verified", score: 30 },
      { points: 8, status: "held", score: null },
      { points: 32, status: "open", score: null },
    ]);
    expect(progress).toEqual({ confirmed: 60, possible: 100, pending: 8, ratio: 0.6 });
    expect(planProgressLabel(progress)).toBe("60 of 100 confirmed points, 60 percent; 8 pending review");
  });

  it("is empty rather than dividing by zero when there is no lineup", () => {
    expect(planProgress([])).toEqual({ confirmed: 0, possible: 0, pending: 0, ratio: 0 });
  });

  it("never fills past full", () => {
    expect(planProgress([{ points: 10, status: "verified", score: 15 }]).ratio).toBe(1);
  });
});
