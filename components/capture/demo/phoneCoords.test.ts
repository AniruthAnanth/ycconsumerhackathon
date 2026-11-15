import { describe, expect, it, vi } from "vitest";

import { DeviceError } from "@/lib/errorMessage";

import { phoneCoords, type PhoneGps } from "./phoneCoords";

const STAGE = { lat: 37.7749, lng: -122.4194 };
const LOBBY = { lat: 37.775, lng: -122.4195 };

function gps(overrides: Partial<PhoneGps> = {}): PhoneGps {
  return {
    requestPermission: async () => undefined,
    hasPermission: async () => true,
    current: async () => STAGE,
    lastKnown: async () => LOBBY,
    ...overrides,
  };
}

const never = () => new Promise<null>(() => undefined);

describe("phoneCoords", () => {
  it("asks for location access before reading the fix", async () => {
    const calls: string[] = [];
    const coords = await phoneCoords(
      gps({
        requestPermission: async () => void calls.push("request"),
        hasPermission: async () => (calls.push("check"), true),
        current: async () => (calls.push("fix"), STAGE),
      }),
    );
    expect(coords).toEqual(STAGE);
    expect(calls).toEqual(["request", "check", "fix"]);
  });

  it("says location is off, without reading GPS, when access is refused", async () => {
    const current = vi.fn(async () => STAGE);
    const pending = phoneCoords(gps({ hasPermission: async () => false, current }));
    await expect(pending).rejects.toThrow(DeviceError);
    await expect(pending).rejects.toThrow("Location access is off");
    expect(current).not.toHaveBeenCalled();
  });

  it("settles for the last known fix when a fresh one is missing or GPS throws", async () => {
    expect(await phoneCoords(gps({ current: async () => null }))).toEqual(LOBBY);
    expect(
      await phoneCoords(
        gps({
          current: async () => {
            throw new Error("kCLErrorDomain 0");
          },
        }),
      ),
    ).toEqual(LOBBY);
  });

  it("settles for the last known fix when a fresh one never arrives", async () => {
    vi.useFakeTimers();
    try {
      const pending = phoneCoords(gps({ current: never }), 6000);
      await vi.advanceTimersByTimeAsync(6000);
      expect(await pending).toEqual(LOBBY);
    } finally {
      vi.useRealTimers();
    }
  });

  it("says so, instead of spinning, when the phone has no fix at all", async () => {
    await expect(phoneCoords(gps({ current: async () => null, lastKnown: async () => null }))).rejects.toThrow(
      "Couldn't get this phone's location",
    );

    vi.useFakeTimers();
    try {
      const pending = phoneCoords(gps({ current: never, lastKnown: never }), 6000);
      const outcome = expect(pending).rejects.toThrow(DeviceError);
      await vi.advanceTimersByTimeAsync(12000);
      await outcome;
    } finally {
      vi.useRealTimers();
    }
  });
});
