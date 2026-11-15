import { describe, expect, it } from "vitest";

import { DEFAULT_MODE, JOIN_MODES, modeOf, stakeLine } from "./joinModes";

describe("join modes", () => {
  it("lists 1v1, quick match, code and create, defaulting to quick match", () => {
    expect(JOIN_MODES.map((mode) => mode.key)).toEqual(["versus", "quickMatch", "code", "create"]);
    expect(DEFAULT_MODE).toBe("quickMatch");
  });

  it("names the primary button after the mode", () => {
    expect(JOIN_MODES.map((mode) => modeOf(mode.key).action)).toEqual(["Challenge a friend", "Find a match", "Join league", "Start creating"]);
  });

  it("explains the pot only for a paid match", () => {
    expect(stakeLine(0)).toBeNull();
    expect(stakeLine(5)).toBe("Everyone pays in, winner takes the pot.");
  });
});
