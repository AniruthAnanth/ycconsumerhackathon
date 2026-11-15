import { describe, expect, it } from "vitest";

import { AWAY_SPOT, YC_OFFICE, type DevFlags } from "../../../lib/devFlags";

import { resolveCaptureCoords, type GpsReader } from "./captureCoords";

const realGps: DevFlags = {
  sampleMedia: false,
  sampleVoice: false,
  locationOverride: false,
  overrideSpot: "place",
};
const place = { lat: 37.7749, lng: -122.4194 };
const fix = { lat: 40.1, lng: -73.9 };
const cached = { lat: 41.2, lng: -74.1 };

function reader(overrides: Partial<GpsReader> = {}): GpsReader {
  return {
    hasPermission: async () => true,
    current: async () => fix,
    lastKnown: async () => cached,
    ...overrides,
  };
}

const never = () => new Promise<never>(() => {});

describe("resolveCaptureCoords", () => {
  it("reports the pinned place while the override is on", async () => {
    const gps = reader({ current: never });
    const coords = await resolveCaptureCoords({ flags: { ...realGps, locationOverride: true }, place, gps });
    expect(coords).toEqual(place);
  });

  it("falls back to the YC office when the override is on and the task pins no place", async () => {
    const coords = await resolveCaptureCoords({
      flags: { ...realGps, locationOverride: true },
      gps: reader(),
    });
    expect(coords).toEqual(YC_OFFICE);
  });

  it("reports a far point when the override is set to away", async () => {
    const coords = await resolveCaptureCoords({
      flags: { ...realGps, locationOverride: true, overrideSpot: "away" },
      place,
      gps: reader(),
    });
    expect(coords).toEqual(AWAY_SPOT);
  });

  it("uses the phone's fix when GPS answers", async () => {
    expect(await resolveCaptureCoords({ flags: realGps, place, gps: reader() })).toEqual(fix);
  });

  it("falls back to the last known fix when GPS is too slow", async () => {
    const coords = await resolveCaptureCoords({
      flags: realGps,
      gps: reader({ current: never }),
      timeoutMs: 10,
    });
    expect(coords).toEqual(cached);
  });

  it("falls back to the last known fix when GPS throws", async () => {
    const gps = reader({ current: async () => Promise.reject(new Error("unavailable")) });
    expect(await resolveCaptureCoords({ flags: realGps, gps })).toEqual(cached);
  });

  it("sends nothing when GPS is too slow and no last fix exists", async () => {
    const gps = reader({ current: never, lastKnown: async () => null });
    expect(await resolveCaptureCoords({ flags: realGps, gps, timeoutMs: 10 })).toBeUndefined();
  });

  it("sends nothing without location permission", async () => {
    const gps = reader({ hasPermission: async () => false, current: never });
    expect(await resolveCaptureCoords({ flags: realGps, place, gps })).toBeUndefined();
  });

  it("still honours the override without location permission", async () => {
    const gps = reader({ hasPermission: async () => false });
    const coords = await resolveCaptureCoords({ flags: { ...realGps, locationOverride: true }, place, gps });
    expect(coords).toEqual(place);
  });
});
