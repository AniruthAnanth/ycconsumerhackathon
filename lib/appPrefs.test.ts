import { describe, expect, it, vi } from "vitest";

vi.mock("./preference", () => ({ readPreference: async () => null, writePreference: async () => {} }));
vi.mock("./native/haptics", () => ({ setHapticsEnabled: () => {} }));

import { parseAppPrefs } from "./appPrefs";

describe("parseAppPrefs", () => {
  it("starts from haptics on and the system's Reduce Motion", () => {
    expect(parseAppPrefs(null)).toEqual({ haptics: true, reduceMotion: "system" });
  });

  it("reads what was saved", () => {
    expect(parseAppPrefs(JSON.stringify({ haptics: false, reduceMotion: "on" }))).toEqual({
      haptics: false,
      reduceMotion: "on",
    });
  });

  it("falls back to the defaults for a value it does not know", () => {
    expect(parseAppPrefs("{not json")).toEqual({ haptics: true, reduceMotion: "system" });
    expect(parseAppPrefs(JSON.stringify({ haptics: "yes", reduceMotion: "always" }))).toEqual({
      haptics: true,
      reduceMotion: "system",
    });
  });
});
