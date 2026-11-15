import { afterEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];

async function load(os: string) {
  calls.length = 0;
  vi.resetModules();
  vi.doMock("react-native", () => ({ Platform: { OS: os } }));
  vi.doMock("expo-haptics", () => ({
    ImpactFeedbackStyle: { Heavy: "heavy", Light: "light" },
    NotificationFeedbackType: { Success: "success", Error: "error" },
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
    expect(calls).toEqual(["impact:heavy", "notify:error"]);
  });

  it("ticks on selection and confirms success", async () => {
    const haptics = await load("ios");
    haptics.select();
    haptics.success();
    await Promise.resolve();
    expect(calls).toEqual(["selection", "notify:success"]);
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
