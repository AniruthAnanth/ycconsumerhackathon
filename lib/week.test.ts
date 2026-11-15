import { describe, expect, it } from "vitest";

import { shiftWeekStart } from "./week";

// Mondays at 00:00 in Los Angeles. PST is UTC-8, PDT is UTC-7.
const nov9 = Date.UTC(2026, 10, 9, 8);
const nov2 = Date.UTC(2026, 10, 2, 8);
const oct26 = Date.UTC(2026, 9, 26, 7);
const mar8 = Date.UTC(2027, 2, 8, 8);
const mar15 = Date.UTC(2027, 2, 15, 7);

describe("shiftWeekStart", () => {
  it("returns the same Monday for zero weeks", () => {
    expect(shiftWeekStart(nov9, 0)).toBe(nov9);
  });

  it("moves by whole weeks when no clock change is crossed", () => {
    expect(shiftWeekStart(nov9, -1)).toBe(nov2);
    expect(shiftWeekStart(nov2, 1)).toBe(nov9);
  });

  it("stays on midnight across the autumn clock change", () => {
    expect(shiftWeekStart(nov9, -2)).toBe(oct26);
    expect(shiftWeekStart(oct26, 2)).toBe(nov9);
  });

  it("stays on midnight across the spring clock change", () => {
    expect(shiftWeekStart(mar8, 1)).toBe(mar15);
    expect(shiftWeekStart(mar15, -1)).toBe(mar8);
  });
});
