import { afterEach, describe, expect, it } from "vitest";

import { AWAY_SPOT, YC_OFFICE, getDevFlags, overrideCoords, setDevFlag } from "./devFlags";

const gym = { name: "Gym", lat: 37.78, lng: -122.41 };

describe("overrideCoords", () => {
  const off = { sampleMedia: false, sampleVoice: false, locationOverride: false, overrideSpot: "place" } as const;

  it("leaves the phone's GPS alone while the override is off", () => {
    expect(overrideCoords(off, gym)).toBeNull();
  });

  it("reports the task's pinned place, so the distance check passes", () => {
    expect(overrideCoords({ ...off, locationOverride: true }, gym)).toEqual({ lat: 37.78, lng: -122.41 });
  });

  it("reports the YC office for a task with no place", () => {
    expect(overrideCoords({ ...off, locationOverride: true })).toEqual(YC_OFFICE);
  });

  it("reports a far point when set to away, so the distance check fails", () => {
    expect(overrideCoords({ ...off, locationOverride: true, overrideSpot: "away" }, gym)).toEqual(AWAY_SPOT);
  });
});

describe("dev flag store", () => {
  afterEach(() => setDevFlag("sampleMedia", false));

  it("starts with every flag off in a build without EXPO_PUBLIC_DEV_FLAGS", () => {
    expect(getDevFlags()).toMatchObject({ sampleMedia: false, sampleVoice: false, locationOverride: false });
  });

  it("replaces the snapshot on change, so subscribed components re-render", () => {
    const before = getDevFlags();
    setDevFlag("sampleMedia", true);
    expect(getDevFlags()).not.toBe(before);
    expect(getDevFlags().sampleMedia).toBe(true);
  });
});
