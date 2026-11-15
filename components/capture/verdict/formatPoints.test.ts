import { describe, expect, it } from "vitest";

import { formatPoints } from "./formatPoints";

describe("formatPoints", () => {
  it("signs a pass and keeps one decimal", () => {
    expect(formatPoints(40)).toBe("+40.0");
    expect(formatPoints(0)).toBe("+0.0");
    expect(formatPoints(12.46)).toBe("+12.5");
  });
});
