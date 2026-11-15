import { describe, expect, it, vi } from "vitest";

import { DeviceError } from "../errorMessage";
import { phoneCoords, type PhoneGps } from "./phoneCoords";

const STAGE = { lat: 37.7749, lng: -122.4194 };

function gps(overrides: Partial<PhoneGps> = {}): PhoneGps {
  return {
    requestPermission: async () => undefined,
    hasPermission: async () => true,
    current: async () => STAGE,
    ...overrides,
  };
}

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

  it("says so when the phone has no fix or GPS throws", async () => {
    await expect(phoneCoords(gps({ current: async () => null }))).rejects.toThrow("Couldn't get this phone's location");
    await expect(
      phoneCoords(
        gps({
          current: async () => {
            throw new Error("kCLErrorDomain 0");
          },
        }),
      ),
    ).rejects.toThrow(DeviceError);
  });

  it("gives up on a fix that never arrives instead of spinning", async () => {
    vi.useFakeTimers();
    try {
      const pending = phoneCoords(gps({ current: () => new Promise(() => undefined) }), 8000);
      const outcome = expect(pending).rejects.toThrow("Couldn't get this phone's location");
      await vi.advanceTimersByTimeAsync(8000);
      await outcome;
    } finally {
      vi.useRealTimers();
    }
  });
});
