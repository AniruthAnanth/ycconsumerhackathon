import { describe, expect, it } from "vitest";

import { DISMISS_DISTANCE, DISMISS_VELOCITY, shouldDismiss } from "./swipeDismiss";

describe("shouldDismiss", () => {
  it("lets go past the distance", () => {
    expect(shouldDismiss(DISMISS_DISTANCE + 1, 0)).toBe(true);
    expect(shouldDismiss(DISMISS_DISTANCE - 1, 0)).toBe(false);
  });

  it("lets go on a quick downward flick", () => {
    expect(shouldDismiss(20, DISMISS_VELOCITY + 1)).toBe(true);
  });

  it("never dismisses an upward drag, however fast", () => {
    expect(shouldDismiss(-200, DISMISS_VELOCITY + 1)).toBe(false);
    expect(shouldDismiss(0, DISMISS_VELOCITY + 1)).toBe(false);
  });
});
