import { describe, expect, it } from "vitest";

import { formatClockCountdown } from "./countdown";

describe("formatClockCountdown", () => {
  it("shows minutes and padded seconds under an hour", () => {
    expect(formatClockCountdown(0)).toBe("0:00");
    expect(formatClockCountdown(9_000)).toBe("0:09");
    expect(formatClockCountdown(754_000)).toBe("12:34");
    expect(formatClockCountdown(3_599_000)).toBe("59:59");
  });

  it("adds hours from one hour up", () => {
    expect(formatClockCountdown(3_600_000)).toBe("1:00:00");
    expect(formatClockCountdown(3_723_000)).toBe("1:02:03");
    expect(formatClockCountdown(36_000_000)).toBe("10:00:00");
  });

  it("rounds a partial second up so zero means over", () => {
    expect(formatClockCountdown(1)).toBe("0:01");
    expect(formatClockCountdown(59_001)).toBe("1:00");
  });

  it("never goes negative", () => {
    expect(formatClockCountdown(-5_000)).toBe("0:00");
    expect(formatClockCountdown(-1)).toBe("0:00");
    expect(formatClockCountdown(-3_600_000)).toBe("0:00");
  });
});
