import { describe, expect, it } from "vitest";

import { COUNT_MS, countValue, easeOutCubic, MAX_MOTION_MS, REORDER_MS } from "./motion";

describe("motion timing", () => {
  it("keeps every animation under the cap", () => {
    expect(COUNT_MS).toBeLessThanOrEqual(MAX_MOTION_MS);
    expect(REORDER_MS).toBeLessThanOrEqual(MAX_MOTION_MS);
  });

  it("eases out and clamps", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it("counts from the old value to the new one", () => {
    expect(countValue(10, 50, 0, 300)).toBe(10);
    expect(countValue(10, 50, 300, 300)).toBe(50);
    const mid = countValue(10, 50, 150, 300);
    expect(mid).toBeGreaterThan(30);
    expect(mid).toBeLessThan(50);
  });

  it("counts down too, and rounds to the shown decimals", () => {
    expect(countValue(50, 10, 150, 300)).toBeLessThan(30);
    expect(countValue(0, 1, 100, 300, 1).toString()).toMatch(/^0\.\d$|^1$/);
  });

  it("jumps straight to the target with no duration (Reduce Motion)", () => {
    expect(countValue(0, 42, 0, 0)).toBe(42);
  });
});
