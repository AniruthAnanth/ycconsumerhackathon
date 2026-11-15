import { afterEach, describe, expect, it, vi } from "vitest";

import type { OnDeviceAnalysis } from "../modules/on-device-referee";

const NOTHING_TO_SAY = { labels: [], likelyMatch: true, hint: "" };
const task = { slot: "body", title: "Leg day at the gym" } as const;

/**
 * Loads lib/onDeviceReferee with the native binding replaced, the way each kind of build sees
 * it: null in Expo Go, an object in a standalone iOS build. The real binding imports expo,
 * which can't load under node.
 */
async function loadWith(native: { analyze: (...args: unknown[]) => Promise<OnDeviceAnalysis> } | null) {
  vi.resetModules();
  vi.doMock("../modules/on-device-referee", () => ({ OnDeviceRefereeNative: native }));
  return import("./onDeviceReferee");
}

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock("../modules/on-device-referee");
});

describe("without the native module (Expo Go, Android, web)", () => {
  it("reports unavailable and has nothing to say", async () => {
    const referee = await loadWith(null);
    expect(referee.isAvailable()).toBe(false);
    await expect(referee.precheck("file:///photo.jpg", task)).resolves.toEqual(NOTHING_TO_SAY);
  });
});

describe("with the native module (standalone iOS build)", () => {
  it("judges what Vision saw against the task", async () => {
    const analyze = vi.fn().mockResolvedValue({
      available: true,
      labels: [{ identifier: "barbell", confidence: 0.8 }],
      people: 0,
      elapsedMs: 40,
    });
    const referee = await loadWith({ analyze });
    expect(referee.isAvailable()).toBe(true);
    const read = await referee.precheck("file:///photo.jpg", task);
    expect(read).toMatchObject({ likelyMatch: true, hint: "On-device: barbell." });
    // People are always counted; hands only when the task has a gesture.
    expect(analyze).toHaveBeenCalledWith("file:///photo.jpg", true, false);
  });

  it("asks for hands when the task has a gesture", async () => {
    const analyze = vi.fn().mockResolvedValue({ available: true, labels: [], fingersUp: [3], elapsedMs: 40 });
    const referee = await loadWith({ analyze });
    await referee.precheck("file:///photo.jpg", { ...task, gesture: "three fingers up" });
    expect(analyze).toHaveBeenCalledWith("file:///photo.jpg", true, true);
  });

  it("has nothing to say when Vision can't run, as on some simulators", async () => {
    const analyze = vi.fn().mockResolvedValue({ available: false, reason: "no inference context", labels: [], elapsedMs: 3 });
    const referee = await loadWith({ analyze });
    await expect(referee.precheck("file:///photo.jpg", task)).resolves.toEqual(NOTHING_TO_SAY);
  });

  it("has nothing to say when the native call fails", async () => {
    const referee = await loadWith({ analyze: vi.fn().mockRejectedValue(new Error("boom")) });
    await expect(referee.precheck("file:///photo.jpg", task)).resolves.toEqual(NOTHING_TO_SAY);
  });

  it("stops waiting after two seconds so a slow read never holds up the proof", async () => {
    vi.useFakeTimers();
    const referee = await loadWith({ analyze: () => new Promise<OnDeviceAnalysis>(() => {}) });
    const read = referee.precheck("file:///photo.jpg", task);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(read).resolves.toEqual(NOTHING_TO_SAY);
  });
});
