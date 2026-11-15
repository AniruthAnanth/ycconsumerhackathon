import { describe, expect, it } from "vitest";

import { FORMATS, formatDuration, ordinal, rankBoard, type Entry } from "./ranking";

const entry = (name: string, value: number, previous: number | null = value): Entry<string> => ({
  userId: name.toLowerCase(),
  name,
  value,
  previous,
});

describe("rankBoard", () => {
  it("orders best first and names the gap to the player above", () => {
    const { rows } = rankBoard([entry("Sam", 180), entry("Maya", 245), entry("Lee", 230)], FORMATS.points, "lee");
    expect(rows.map((row) => [row.rank, row.name, row.gapLabel])).toEqual([
      [1, "Maya", "15 ahead of Lee"],
      [2, "Lee", "15 behind Maya"],
      [3, "Sam", "50 behind Lee"],
    ]);
    expect(rows.map((row) => row.isMe)).toEqual([false, true, false]);
  });

  it("gives level players the same place and skips the next one", () => {
    const { rows } = rankBoard(
      [entry("Ana", 100), entry("Bo", 90), entry("Cy", 90), entry("Di", 70)],
      FORMATS.points,
      null,
    );
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 2, 4]);
    expect(rows[2].gapLabel).toBe("Level with Bo");
  });

  it("reports places gained and lost since yesterday", () => {
    const { rows } = rankBoard(
      [entry("Maya", 245, 200), entry("Lee", 230, 230), entry("Sam", 180, 180)],
      FORMATS.points,
      null,
    );
    // Yesterday: Lee 230, Maya 200, Sam 180.
    expect(rows.map((row) => [row.name, row.movement])).toEqual([
      ["Maya", 1],
      ["Lee", -1],
      ["Sam", 0],
    ]);
  });

  it("treats a player new to the board as having stood below everyone", () => {
    const { rows } = rankBoard([entry("Maya", 50, 50), entry("Lee", 80, null), entry("Sam", 20, 20)], FORMATS.points, null);
    expect(rows.find((row) => row.name === "Lee")?.movement).toBe(2);
  });

  it("names the nearer neighbour as the rival", () => {
    const board = [entry("Maya", 245), entry("Lee", 230), entry("Sam", 222), entry("Kai", 100)];
    const chasing = rankBoard(board, FORMATS.points, "lee");
    expect(chasing.rival).toEqual({ userId: "sam", name: "Sam", label: "Sam is 8 behind you" });
    expect(chasing.rows.map((row) => row.isRival)).toEqual([false, false, true, false]);

    const leading = rankBoard(board, FORMATS.points, "sam");
    expect(leading.rival?.label).toBe("Lee is 8 ahead of you");
  });

  it("prefers the player above when both neighbours are equally close", () => {
    const { rival } = rankBoard([entry("Maya", 110), entry("Lee", 100), entry("Sam", 90)], FORMATS.points, "lee");
    expect(rival?.name).toBe("Maya");
  });

  it("has no rival for a caller who is alone or not on the board", () => {
    expect(rankBoard([entry("Maya", 10)], FORMATS.points, "maya").rival).toBeUndefined();
    expect(rankBoard([entry("Maya", 10), entry("Lee", 5)], FORMATS.points, "sam").rival).toBeUndefined();
    expect(rankBoard([entry("Maya", 10)], FORMATS.points, "maya").rows[0].gapLabel).toBeUndefined();
  });

  it("says so when the caller and the rival are level", () => {
    const { rival } = rankBoard([entry("Maya", 100), entry("Lee", 100)], FORMATS.points, "lee");
    expect(rival?.label).toBe("You and Maya are level");
  });

  it("ranks the smallest value first on a time board", () => {
    const { rows, rival } = rankBoard([entry("Sam", 95), entry("Maya", 42), entry("Lee", 61)], FORMATS.seconds, "sam");
    expect(rows.map((row) => [row.rank, row.name, row.valueLabel, row.gapLabel])).toEqual([
      [1, "Maya", "42s", "19s ahead of Lee"],
      [2, "Lee", "1m 01s", "19s behind Maya"],
      [3, "Sam", "1m 35s", "34s behind Lee"],
    ]);
    expect(rival?.label).toBe("Lee is 34s ahead of you");
  });

  it("breaks a level record on the tiebreak and keeps the caller's own label", () => {
    const { rows } = rankBoard(
      [
        { ...entry("Sam", 2), tiebreak: 400, valueLabel: "2-1" },
        { ...entry("Maya", 2), tiebreak: 520, valueLabel: "2-1" },
        { ...entry("Lee", 3), tiebreak: 100, valueLabel: "3-0" },
      ],
      FORMATS.wins,
      null,
    );
    expect(rows.map((row) => [row.rank, row.name, row.valueLabel])).toEqual([
      [1, "Lee", "3-0"],
      [2, "Maya", "2-1"],
      [3, "Sam", "2-1"],
    ]);
    expect(rows[1].gapLabel).toBe("1 win behind Lee");
  });

  it("formats money to the cent", () => {
    const { rows } = rankBoard([entry("Maya", 12.4), entry("Lee", -5)], FORMATS.money, "lee");
    expect(rows.map((row) => [row.valueLabel, row.gapLabel])).toEqual([
      ["+$12.40", "$17.40 ahead of Lee"],
      ["-$5.00", "$17.40 behind Maya"],
    ]);
  });
});

describe("formatDuration", () => {
  it("reads as seconds under a minute and minutes above", () => {
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(60)).toBe("1m 00s");
    expect(formatDuration(185)).toBe("3m 05s");
  });
});

describe("ordinal", () => {
  it("handles the teens", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "103rd",
    ]);
  });
});
