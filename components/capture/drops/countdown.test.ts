import { describe, expect, it } from "vitest";

import { formatCountdown } from "./countdown";

describe("formatCountdown", () => {
  it("shows minutes and padded seconds under an hour", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(9_000)).toBe("0:09");
    expect(formatCountdown(754_000)).toBe("12:34");
    expect(formatCountdown(3_599_000)).toBe("59:59");
  });

  it("adds hours from one hour up", () => {
    expect(formatCountdown(3_600_000)).toBe("1:00:00");
    expect(formatCountdown(3_723_000)).toBe("1:02:03");
    expect(formatCountdown(36_000_000)).toBe("10:00:00");
  });

  it("rounds a partial second up so zero means over", () => {
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatCountdown(59_001)).toBe("1:00");
  });

  it("never goes negative", () => {
    expect(formatCountdown(-5_000)).toBe("0:00");
  });
});
