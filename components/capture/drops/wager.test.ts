import { describe, expect, it } from "vitest";

import { clampWager, stepWager } from "./wager";

describe("clampWager", () => {
  it("keeps values already on the grid", () => {
    expect(clampWager(0)).toBe(0);
    expect(clampWager(30)).toBe(30);
    expect(clampWager(50)).toBe(50);
  });

  it("limits to 0 through 50", () => {
    expect(clampWager(-10)).toBe(0);
    expect(clampWager(80)).toBe(50);
  });

  it("snaps off-grid values to the nearest step", () => {
    expect(clampWager(14)).toBe(10);
    expect(clampWager(26)).toBe(30);
  });

  it("treats non-numbers as no wager", () => {
    expect(clampWager(Number.NaN)).toBe(0);
  });
});

describe("stepWager", () => {
  it("moves by ten", () => {
    expect(stepWager(20, 1)).toBe(30);
    expect(stepWager(20, -1)).toBe(10);
  });

  it("stops at both ends", () => {
    expect(stepWager(0, -1)).toBe(0);
    expect(stepWager(50, 1)).toBe(50);
  });
});
