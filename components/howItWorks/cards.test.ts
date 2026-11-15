import { describe, expect, it } from "vitest";

import { CARDS, exitOf } from "./cards";

describe("How Lineup works", () => {
  it("has the four ideas in order", () => {
    expect(CARDS.map((card) => card.key)).toEqual(["draft", "prove", "beat", "pot"]);
  });

  it("returns to Profile, replays sign-up from Demo controls, and otherwise goes on to sign-up", () => {
    expect(exitOf("profile")).toBe("back");
    expect(exitOf("replay")).toBe("replay");
    expect(exitOf(undefined)).toBe("signup");
  });
});
