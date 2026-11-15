import { describe, expect, it } from "vitest";

import { potEmptyText, slotsText } from "./emptyState";

describe("potEmptyText", () => {
  it("says a free league has no pot", () => {
    expect(potEmptyText({ stakeUsd: 0, potUsd: 0 })).toBe("Free league: no pot");
  });
  it("explains an empty paid pot", () => {
    expect(potEmptyText({ stakeUsd: 10, potUsd: 0 })).toBe("The pot fills as players pay in");
  });
  it("is null once money is in", () => {
    expect(potEmptyText({ stakeUsd: 10, potUsd: 20 })).toBeNull();
  });
});

describe("slotsText", () => {
  it("asks for a lineup when nothing is cleared and no points", () => {
    expect(slotsText({ slotsCleared: 0, points: 0, paid: true })).toBe("Draft your lineup to fill your 5 slots");
  });
  it("shows the count once played", () => {
    expect(slotsText({ slotsCleared: 2, points: 12, paid: true })).toBe("2/5 slots");
    expect(slotsText({ slotsCleared: 0, points: 3, paid: true })).toBe("0/5 slots");
  });
  it("keeps Unpaid", () => {
    expect(slotsText({ slotsCleared: 0, points: 0, paid: false })).toBe("Unpaid");
  });
});
