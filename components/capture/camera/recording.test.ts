import { describe, expect, it } from "vitest";

import { recordedDurationMs, secondsLeft } from "./recording";

describe("secondsLeft", () => {
  it("starts at the full length", () => expect(secondsLeft(0)).toBe(10));
  it("rounds a partial second up so the counter never shows 0 early", () => expect(secondsLeft(9100)).toBe(1));
  it("stops at zero", () => expect(secondsLeft(12000)).toBe(0));
});

describe("recordedDurationMs", () => {
  it("measures an early stop", () => expect(recordedDurationMs(1000, 4500)).toBe(3500));
  it("caps at the maximum when stop lags the native cutoff", () => expect(recordedDurationMs(0, 10400)).toBe(10000));
  it("never goes negative", () => expect(recordedDurationMs(5000, 4000)).toBe(0));
});
