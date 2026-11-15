import { describe, expect, it } from "vitest";

import { draftWeekNote } from "./draftWeek";

describe("draftWeekNote", () => {
  it("says nothing while this week can still be drafted", () => {
    expect(draftWeekNote(false)).toBeNull();
  });

  it("names next week once this week is locked", () => {
    expect(draftWeekNote(true)).toBe("This week is locked. You're drafting next week.");
  });

  it("says nothing while the roster is loading", () => {
    expect(draftWeekNote(undefined)).toBeNull();
  });
});
