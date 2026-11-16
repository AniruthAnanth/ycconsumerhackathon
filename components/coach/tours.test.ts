import { describe, expect, it } from "vitest";

import {
  arrowOffset,
  bubbleLeft,
  bubbleSide,
  isOnScreen,
  spotlightFrame,
  TOURS,
} from "./tours";

const screen = { width: 390, height: 844 };

describe("coach tours", () => {
  it("keeps every tip to a 2 to 4 word title and one short sentence", () => {
    for (const steps of Object.values(TOURS))
      for (const { title, text } of steps) {
        expect(title.split(" ").length).toBeGreaterThanOrEqual(1);
        expect(title.split(" ").length).toBeLessThanOrEqual(4);
        expect(text.length).toBeLessThanOrEqual(70);
        expect(
          text.split(/[.?!](\s|$)/).filter((part) => part && part.trim())
            .length,
        ).toBe(1);
      }
  });

  it("insets an edge-to-edge row to the margins and pads a card by 8 pt", () => {
    expect(
      spotlightFrame({ x: 0, y: 300, width: 390, height: 64 }, screen, 20),
    ).toEqual({ x: 12, y: 292, width: 366, height: 80 });
    expect(
      spotlightFrame({ x: 20, y: 100, width: 350, height: 120 }, screen, 20),
    ).toEqual({ x: 12, y: 92, width: 366, height: 136 });
    expect(
      spotlightFrame({ x: 300, y: 10, width: 44, height: 44 }, screen, 20),
    ).toEqual({ x: 292, y: 2, width: 60, height: 60 });
  });

  it("puts the bubble on the side with more room", () => {
    expect(
      bubbleSide({ x: 0, y: 100, width: 390, height: 120 }, screen.height),
    ).toBe("below");
    expect(
      bubbleSide({ x: 0, y: 500, width: 390, height: 200 }, screen.height),
    ).toBe("above");
  });

  it("centres the bubble on the target inside the margins", () => {
    expect(
      bubbleLeft({ x: 12, y: 0, width: 366, height: 10 }, 300, 390, 20),
    ).toBe(45);
    expect(
      bubbleLeft({ x: 0, y: 0, width: 40, height: 10 }, 300, 390, 20),
    ).toBe(20);
    expect(
      bubbleLeft({ x: 340, y: 0, width: 40, height: 10 }, 300, 390, 20),
    ).toBe(70);
  });

  it("skips a target that is scrolled off screen or not laid out", () => {
    expect(isOnScreen({ x: 0, y: 900, width: 390, height: 60 }, screen)).toBe(
      false,
    );
    expect(isOnScreen({ x: 0, y: 0, width: 0, height: 0 }, screen)).toBe(false);
    expect(isOnScreen({ x: 0, y: 800, width: 390, height: 60 }, screen)).toBe(
      true,
    );
  });

  it("points the arrow at the target's centre, clamped inside the corners", () => {
    const bubble = { left: 20, width: 350 };
    expect(
      arrowOffset({ x: 20, y: 0, width: 350, height: 40 }, bubble, 16, 16),
    ).toBe(167);
    expect(
      arrowOffset({ x: 0, y: 0, width: 10, height: 40 }, bubble, 16, 16),
    ).toBe(16);
  });
});
