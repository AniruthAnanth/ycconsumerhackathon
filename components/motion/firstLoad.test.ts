import { beforeEach, describe, expect, it } from "vitest";

import { FIRST_LOAD_WINDOW_MS, firstLoad, resetFirstLoad } from "./firstLoad";

describe("firstLoad", () => {
  beforeEach(resetFirstLoad);

  it("animates a screen's first load, rows that arrive with it included", () => {
    expect(firstLoad("/league", 1000)).toBe(true);
    expect(firstLoad("/league", 1000 + FIRST_LOAD_WINDOW_MS)).toBe(true);
  });

  it("never animates a revisit", () => {
    firstLoad("/league", 1000);
    expect(firstLoad("/league", 1000 + FIRST_LOAD_WINDOW_MS + 1)).toBe(false);
  });

  it("keeps each screen's window separate", () => {
    firstLoad("/league", 1000);
    expect(firstLoad("/feed", 99_000)).toBe(true);
  });
});
