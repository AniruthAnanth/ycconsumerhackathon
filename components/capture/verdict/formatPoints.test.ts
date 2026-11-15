import { describe, expect, it } from "vitest";

import { countedPoints, formatPoints, NO_POINTS } from "./formatPoints";

describe("formatPoints", () => {
  it("signs a pass and keeps one decimal", () => {
    expect(formatPoints(40, true)).toBe("+40.0");
    expect(formatPoints(0, true)).toBe("+0.0");
    expect(formatPoints(12.46, true)).toBe("+12.5");
  });

  it("shows a dash on a fail whatever the points say", () => {
    expect(formatPoints(40, false)).toBe(NO_POINTS);
  });
});

describe("countedPoints", () => {
  it("scales the target by progress and clamps it", () => {
    expect(countedPoints(40, 0)).toBe(0);
    expect(countedPoints(40, 0.5)).toBe(20);
    expect(countedPoints(40, 1)).toBe(40);
    expect(countedPoints(40, 1.2)).toBe(40);
    expect(countedPoints(40, -1)).toBe(0);
  });
});
