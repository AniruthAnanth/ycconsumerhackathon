import { describe, expect, it } from "vitest";

import { formatCountdown, formatUsd } from "./leagueText";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatUsd", () => {
  it("drops the cents on whole amounts", () => {
    expect(formatUsd(20)).toBe("$20");
    expect(formatUsd(0)).toBe("$0");
  });

  it("keeps two decimals otherwise", () => {
    expect(formatUsd(36.5)).toBe("$36.50");
    expect(formatUsd(7.25)).toBe("$7.25");
  });
});

describe("formatCountdown", () => {
  it("shows days and hours when a day or more remains", () => {
    expect(formatCountdown(2 * DAY + 4 * HOUR + 30 * MINUTE)).toBe("2d 4h");
    expect(formatCountdown(DAY)).toBe("1d 0h");
  });

  it("shows hours and minutes under a day", () => {
    expect(formatCountdown(3 * HOUR + 12 * MINUTE)).toBe("3h 12m");
  });

  it("shows minutes alone under an hour", () => {
    expect(formatCountdown(12 * MINUTE)).toBe("12m");
    expect(formatCountdown(20_000)).toBe("1m");
  });

  it("reads Settled at or below zero", () => {
    expect(formatCountdown(0)).toBe("Settled");
    expect(formatCountdown(-5 * MINUTE)).toBe("Settled");
  });
});
