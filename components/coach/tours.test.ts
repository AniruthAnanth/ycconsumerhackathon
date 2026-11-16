import { describe, expect, it } from "vitest";

import { arrowOffset, bubbleSide, isOnScreen, TOURS } from "./tours";

const screen = { width: 390, height: 844 };

describe("coach tours", () => {
  it("keeps every tip to one short sentence", () => {
    for (const steps of Object.values(TOURS))
      for (const { text } of steps) {
        expect(text.length).toBeLessThanOrEqual(70);
        expect(text.split(/[.?!](\s|$)/).filter((part) => part && part.trim()).length).toBe(1);
      }
  });

  it("puts the bubble under a target in the top half and over one in the bottom half", () => {
    expect(bubbleSide({ x: 0, y: 100, width: 390, height: 120 }, screen.height)).toBe("below");
    expect(bubbleSide({ x: 0, y: 600, width: 390, height: 80 }, screen.height)).toBe("above");
  });

  it("skips a target that is scrolled off screen or not laid out", () => {
    expect(isOnScreen({ x: 0, y: 900, width: 390, height: 60 }, screen)).toBe(false);
    expect(isOnScreen({ x: 0, y: -80, width: 390, height: 60 }, screen)).toBe(false);
    expect(isOnScreen({ x: 0, y: 0, width: 0, height: 0 }, screen)).toBe(false);
    expect(isOnScreen({ x: 0, y: 800, width: 390, height: 60 }, screen)).toBe(true);
  });

  it("points the arrow at the target's centre, clamped inside the corners", () => {
    const bubble = { left: 20, width: 350 };
    expect(arrowOffset({ x: 20, y: 0, width: 350, height: 40 }, bubble, 16, 16)).toBe(167);
    expect(arrowOffset({ x: 0, y: 0, width: 10, height: 40 }, bubble, 16, 16)).toBe(16);
    expect(arrowOffset({ x: 380, y: 0, width: 10, height: 40 }, bubble, 16, 16)).toBe(318);
  });
});
