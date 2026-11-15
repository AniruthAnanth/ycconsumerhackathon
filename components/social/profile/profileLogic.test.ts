import { describe, expect, it } from "vitest";

import { formatDuration, formatPercent, formatPoints, formatStreak } from "./profileLogic";

describe("formatPercent", () => {
  it("rounds a 0..1 rate to a whole percent", () => {
    expect(formatPercent(0.86)).toBe("86%");
    expect(formatPercent(0.855)).toBe("86%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1)).toBe("100%");
  });
});

describe("formatStreak", () => {
  it("uses the singular for exactly one day", () => {
    expect(formatStreak(1)).toBe("1 day");
  });

  it("uses the plural for zero and many days", () => {
    expect(formatStreak(0)).toBe("0 days");
    expect(formatStreak(4)).toBe("4 days");
  });
});

describe("formatPoints", () => {
  it("shows one decimal place", () => {
    expect(formatPoints(312)).toBe("312.0 pts");
    expect(formatPoints(87.25)).toBe("87.3 pts");
  });
});

describe("formatDuration", () => {
  it("shows minutes and seconds past a minute", () => {
    expect(formatDuration(102)).toBe("1m 42s");
    expect(formatDuration(120)).toBe("2m 0s");
  });

  it("shows only seconds under a minute", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(0)).toBe("0s");
  });
});
