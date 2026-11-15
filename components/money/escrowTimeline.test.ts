import { describe, expect, it } from "vitest";

import {
  ESCROW_DROP_MS,
  ESCROW_LEAD_MS,
  ESCROW_PULSE_MS,
  ESCROW_SETTLE_MS,
  ESCROW_TRAVEL_MS,
  MAX_MOTION_MS,
} from "@/lib/native/motion";

import { COINS_PER_MEMBER, coinProgress, escrowTimeline, LANE_MS } from "./escrowTimeline";

describe("escrow motion", () => {
  it("keeps every step under the app's cap", () => {
    for (const step of [ESCROW_TRAVEL_MS, ESCROW_PULSE_MS, ESCROW_DROP_MS, ESCROW_SETTLE_MS]) {
      expect(step).toBeLessThanOrEqual(MAX_MOTION_MS);
    }
  });
});

describe("escrowTimeline", () => {
  it("staggers the members and lands each one a trip later", () => {
    const { starts, landings } = escrowTimeline(3);
    expect(starts[0]).toBe(ESCROW_LEAD_MS);
    expect(starts[1]!).toBeGreaterThan(starts[0]!);
    expect(starts[2]!).toBeGreaterThan(starts[1]!);
    expect(landings).toEqual(starts.map((start) => start + ESCROW_TRAVEL_MS));
  });

  it("draws the line only after the last dollar is in", () => {
    const { starts, settleAt, endsAt } = escrowTimeline(4);
    expect(settleAt).toBe(starts[3]! + LANE_MS);
    expect(endsAt).toBeGreaterThan(settleAt);
  });

  it("finishes inside two seconds for any league, one member to twelve", () => {
    for (let count = 1; count <= 12; count += 1) {
      expect(escrowTimeline(count).endsAt).toBeLessThanOrEqual(2000);
    }
    expect(escrowTimeline(12).endsAt).toBeGreaterThanOrEqual(1500);
  });

  it("has nothing to wait for when nobody has paid", () => {
    expect(escrowTimeline(0)).toMatchObject({ starts: [], landings: [], settleAt: 0 });
  });
});

describe("coinProgress", () => {
  it("sends the first dollar at once and holds the later ones back", () => {
    const early = 0.1;
    expect(coinProgress(early, 0)).toBeGreaterThan(0);
    expect(coinProgress(early, COINS_PER_MEMBER - 1)).toBe(0);
  });

  it("has every dollar home when the lane ends", () => {
    for (let index = 0; index < COINS_PER_MEMBER; index += 1) expect(coinProgress(1, index)).toBe(1);
  });
});
