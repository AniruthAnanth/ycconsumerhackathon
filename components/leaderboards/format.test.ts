import { describe, expect, it } from "vitest";

import { BOARDS, parseBoardKey } from "./boards";
import { formatUsdWithCents, hourStart, isProjectedGain, movementMark, ordinal, placeLabel, projectionDetail, rowSubtitle, tiedRanks } from "./format";
import type { BoardRow } from "./types";

const row = (overrides: Partial<BoardRow>): BoardRow => ({
  rank: 1,
  userId: "user1" as BoardRow["userId"],
  name: "Maya",
  value: 10,
  valueLabel: "10",
  movement: 0,
  isMe: false,
  isRival: false,
  ...overrides,
});

describe("ordinal", () => {
  it("uses st, nd, rd and th", () => {
    expect([1, 2, 3, 4, 10, 21, 22, 23, 101].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "10th", "21st", "22nd", "23rd", "101st"]);
  });

  it("treats the teens as th", () => {
    expect([11, 12, 13, 111, 112].map(ordinal)).toEqual(["11th", "12th", "13th", "111th", "112th"]);
  });
});

describe("formatUsdWithCents", () => {
  it("always shows two decimals", () => {
    expect(formatUsdWithCents(5)).toBe("$5.00");
    expect(formatUsdWithCents(27.5)).toBe("$27.50");
    expect(formatUsdWithCents(0)).toBe("$0.00");
  });
});

describe("movementMark", () => {
  it("marks gains, losses and no change", () => {
    expect(movementMark(2)).toEqual({ text: "▲2", tone: "up" });
    expect(movementMark(-1)).toEqual({ text: "▼1", tone: "down" });
    expect(movementMark(0)).toEqual({ text: "–", tone: "flat" });
  });
});

describe("rowSubtitle", () => {
  it("joins the gap and the detail", () => {
    expect(rowSubtitle({ gapLabel: "15 behind Maya", detail: "4/5 slots" })).toBe("15 behind Maya · 4/5 slots");
  });

  it("shows whichever one exists, or nothing", () => {
    expect(rowSubtitle({ gapLabel: "15 behind Maya" })).toBe("15 behind Maya");
    expect(rowSubtitle({ detail: "4/5 slots" })).toBe("4/5 slots");
    expect(rowSubtitle({})).toBe("");
  });
});

describe("placeLabel", () => {
  it("names the caller's place and gap", () => {
    expect(placeLabel([row({}), row({ rank: 2, isMe: true, gapLabel: "15 behind Maya" })])).toBe("2nd · 15 behind Maya");
  });

  it("shows the leader's lead the same way", () => {
    expect(placeLabel([row({ isMe: true, gapLabel: "15 ahead of Sam" })])).toBe("1st · 15 ahead of Sam");
  });

  it("is just the place when there is no gap", () => {
    expect(placeLabel([row({ isMe: true })])).toBe("1st");
  });

  it("is undefined when the caller is not on the board", () => {
    expect(placeLabel([row({})])).toBeUndefined();
    expect(placeLabel([])).toBeUndefined();
  });
});

describe("projection text", () => {
  it("is a gain only for an eligible player expected to come out ahead", () => {
    expect(isProjectedGain({ eligible: true, expectedUsd: 12.4, stakeUsd: 5 })).toBe(true);
    expect(isProjectedGain({ eligible: true, expectedUsd: 5, stakeUsd: 5 })).toBe(false);
    expect(isProjectedGain({ eligible: true, expectedUsd: 2, stakeUsd: 5 })).toBe(false);
  });

  it("is never a gain for an unpaid player, whatever the numbers say", () => {
    expect(isProjectedGain({ eligible: false, expectedUsd: 0, stakeUsd: 0 })).toBe(false);
    expect(isProjectedGain({ eligible: false, expectedUsd: 30, stakeUsd: 5 })).toBe(false);
  });

  it("spells out the range", () => {
    expect(projectionDetail({ ifEndedNowUsd: 5, lowUsd: 0, highUsd: 27.5 })).toBe("If it ended now $5.00 · Low $0.00 · High $27.50");
  });
});

describe("hourStart", () => {
  it("rounds down to the hour", () => {
    const hour = Date.UTC(2026, 10, 15, 20);
    expect(hourStart(hour + 59 * 60_000 + 999)).toBe(hour);
    expect(hourStart(hour)).toBe(hour);
  });
});

describe("boards", () => {
  it("lists sixteen distinct boards starting with This Week, Global All-Time after Global", () => {
    expect(BOARDS).toHaveLength(16);
    expect(new Set(BOARDS.map((board) => board.key)).size).toBe(16);
    expect(BOARDS[0]).toEqual({ key: "week", label: "This Week" });
    const keys = BOARDS.map((board) => board.key);
    expect(keys[keys.indexOf("global") + 1]).toBe("globalAllTime");
  });

  it("parses a route param only when it names a board", () => {
    expect(parseBoardKey("money")).toBe("money");
    expect(parseBoardKey(["streak", "week"])).toBe("streak");
    expect(parseBoardKey("nope")).toBeUndefined();
    expect(parseBoardKey(undefined)).toBeUndefined();
  });
});

describe("tiedRanks", () => {
  it("returns only the ranks held by more than one row", () => {
    const rows = [1, 2, 2, 4, 5, 5, 5].map((rank) => row({ rank }));
    expect([...tiedRanks(rows)]).toEqual([2, 5]);
  });

  it("is empty when every rank is unique", () => {
    expect(tiedRanks([row({ rank: 1 }), row({ rank: 2 })]).size).toBe(0);
  });
});
