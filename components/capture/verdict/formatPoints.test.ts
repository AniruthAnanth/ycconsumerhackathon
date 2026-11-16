import { describe, expect, it } from "vitest";

import { formatPoints } from "./formatPoints";

describe("formatPoints", () => {
  it("signs a pass and writes it like every other score", () => {
    expect(formatPoints(40)).toBe("+40");
    expect(formatPoints(0)).toBe("+0");
    expect(formatPoints(12.46)).toBe("+12.5");
  });
});
