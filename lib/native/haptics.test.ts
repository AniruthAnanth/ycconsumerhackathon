import { afterEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];

async function load(os: string) {
  calls.length = 0;
  vi.resetModules();
  vi.doMock("react-native", () => ({ Platform: { OS: os } }));
  vi.doMock("expo-haptics", () => ({
    ImpactFeedbackStyle: { Heavy: "heavy", Light: "light", Medium: "medium", Rigid: "rigid" },
    NotificationFeedbackType: { Success: "success", Error: "error", Warning: "warning" },
    impactAsync: async (style: string) => void calls.push(`impact:${style}`),
    notificationAsync: async (type: string) => void calls.push(`notify:${type}`),
    selectionAsync: async () => void calls.push("selection"),
  }));
  return (await import("./haptics")).haptics;
}

afterEach(() => {
  vi.doUnmock("react-native");
  vi.doUnmock("expo-haptics");
});

describe("haptics", () => {
  it("thuds for VERIFIED and buzzes for NOT VERIFIED", async () => {
    const haptics = await load("ios");
    haptics.stamp(true);
    haptics.stamp(false);
    await Promise.resolve();
    expect(calls).toEqual(["impact:heavy", "notify:warning"]);
  });

  it("ticks on selection and confirms success", async () => {
    const haptics = await load("ios");
    haptics.select();
    haptics.success();
    await Promise.resolve();
    expect(calls).toEqual(["selection", "notify:success"]);
  });

  it("is silent while Settings has haptics off, and plays again once back on", async () => {
    const haptics = await load("ios");
    const { setHapticsEnabled } = await import("./haptics");
    setHapticsEnabled(false);
    haptics.select();
    setHapticsEnabled(true);
    haptics.success();
    await Promise.resolve();
    expect(calls).toEqual(["notify:success"]);
  });

  it("throttles count-up ticks to one per TICK_MS", async () => {
    const haptics = await load("ios");
    const { TICK_MS } = await import("./haptics");
    for (let now = 1000; now < 1000 + TICK_MS * 3; now += 16) haptics.tick(now);
    await Promise.resolve();
    expect(calls).toEqual(["impact:rigid", "impact:rigid", "impact:rigid"]);
  });

  it("lands the perfect week heavy", async () => {
    const haptics = await load("ios");
    haptics.perfect();
    await Promise.resolve();
    expect(calls).toEqual(["impact:heavy"]);
  });

  it("gives shared presses a light or medium tap, and nothing for none", async () => {
    const haptics = await load("ios");
    haptics.press("light");
    haptics.press("none");
    haptics.press("medium");
    await Promise.resolve();
    expect(calls).toEqual(["impact:light", "impact:medium"]);
  });

  it("drops the L as heavy then light", async () => {
    vi.useFakeTimers();
    const haptics = await load("ios");
    haptics.drop();
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    expect(calls).toEqual(["impact:heavy", "impact:light"]);
  });

  it("keeps ticks and drops silent while Settings has haptics off", async () => {
    const haptics = await load("ios");
    const { setHapticsEnabled } = await import("./haptics");
    setHapticsEnabled(false);
    haptics.tick(5000);
    haptics.press("light");
    await Promise.resolve();
    expect(calls).toEqual([]);
  });

  it("is silent on the web", async () => {
    const haptics = await load("web");
    haptics.stamp(true);
    haptics.select();
    await Promise.resolve();
    expect(calls).toEqual([]);
  });

  it("never throws when the device has no haptics", async () => {
    vi.resetModules();
    vi.doMock("react-native", () => ({ Platform: { OS: "ios" } }));
    vi.doMock("expo-haptics", () => ({
      ImpactFeedbackStyle: {},
      NotificationFeedbackType: {},
      selectionAsync: () => Promise.reject(new Error("no taptic engine")),
    }));
    const { haptics } = await import("./haptics");
    expect(() => haptics.select()).not.toThrow();
  });
});
