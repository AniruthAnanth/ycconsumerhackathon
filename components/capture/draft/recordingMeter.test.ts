import { describe, expect, it } from "vitest";

import { MAX_RECORDING_MS, formatElapsed, hasReachedLimit, meterLevel, pushLevel } from "./recordingMeter";

describe("pushLevel", () => {
  it("appends the newest level and keeps the last few", () => {
    expect(pushLevel([0.1, 0.2], 0.3, 3)).toEqual([0.1, 0.2, 0.3]);
    expect(pushLevel([0.1, 0.2, 0.3], 0.4, 3)).toEqual([0.2, 0.3, 0.4]);
  });
});

describe("meterLevel", () => {
  it("maps speech loudness onto 0 to 1", () => {
    expect(meterLevel(-30)).toBeCloseTo(0.5);
  });

  it("clamps silence and clipping", () => {
    expect(meterLevel(-160)).toBe(0);
    expect(meterLevel(0)).toBe(1);
  });

  it("is zero while metering has not reported", () => {
    expect(meterLevel(undefined)).toBe(0);
  });
});

describe("formatElapsed", () => {
  it("shows minutes and zero-padded seconds", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(7_900)).toBe("0:07");
    expect(formatElapsed(60_000)).toBe("1:00");
  });
});

describe("hasReachedLimit", () => {
  it("fires at sixty seconds", () => {
    expect(hasReachedLimit(MAX_RECORDING_MS - 1)).toBe(false);
    expect(hasReachedLimit(MAX_RECORDING_MS)).toBe(true);
  });
});
