import { afterEach, describe, expect, it, vi } from "vitest";

import type { LiveActivityState } from "./liveActivityState";

const state = { kind: "matchup", leagueName: "L" } as LiveActivityState;

/** Loads lib/liveActivity with the native binding replaced: null in Expo Go, an object in an iOS build. */
async function loadWith(native: Record<string, unknown> | null) {
  vi.resetModules();
  vi.doMock("../modules/live-activity", () => ({ LiveActivityNative: native }));
  return import("./liveActivity");
}

afterEach(() => vi.doUnmock("../modules/live-activity"));

describe("without the native module (Expo Go, Android, web)", () => {
  it("is unavailable and every call resolves", async () => {
    const activity = await loadWith(null);
    expect(activity.isAvailable()).toBe(false);
    await expect(activity.startDrop(state)).resolves.toBeUndefined();
    await expect(activity.startMatchup(state)).resolves.toBeUndefined();
    await expect(activity.update(state)).resolves.toBeUndefined();
    await expect(activity.end()).resolves.toBeUndefined();
  });
});

describe("with the native module (standalone iOS build)", () => {
  it("passes the state as JSON and follows the player's setting", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const activity = await loadWith({ areActivitiesEnabled: () => true, start });
    expect(activity.isAvailable()).toBe(true);
    await activity.startDrop(state);
    expect(start).toHaveBeenCalledWith(JSON.stringify(state));
    expect((await loadWith({ areActivitiesEnabled: () => false })).isAvailable()).toBe(false);
  });

  it("swallows a failing native call", async () => {
    const reject = vi.fn().mockRejectedValue(new Error("boom"));
    const activity = await loadWith({
      areActivitiesEnabled: () => {
        throw new Error("boom");
      },
      start: reject,
      update: reject,
      end: reject,
    });
    expect(activity.isAvailable()).toBe(false);
    await expect(activity.startDrop(state)).resolves.toBeUndefined();
    await expect(activity.update(state)).resolves.toBeUndefined();
    await expect(activity.end()).resolves.toBeUndefined();
  });
});
