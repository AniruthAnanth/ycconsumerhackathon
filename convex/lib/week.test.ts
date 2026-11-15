import { describe, expect, test } from "vitest";

import {
  DAY_MS,
  HOUR_MS,
  clockLabel,
  dayOfWeek,
  pacificDay,
  pacificOffsetHours,
  pairsAfterJoin,
  startOfPacificDay,
  weekEndOf,
  weekPairings,
  weekStartOf,
  weekdayLabel,
} from "./week";

const utc = (iso: string) => new Date(iso).getTime();

describe("Pacific time", () => {
  test("the offset follows US daylight saving", () => {
    expect(pacificOffsetHours(utc("2026-01-15T12:00:00Z"))).toBe(-8);
    expect(pacificOffsetHours(utc("2026-07-01T12:00:00Z"))).toBe(-7);
    // Clocks go forward at 10:00 UTC on 8 March 2026 and back at 09:00 UTC on 1 November 2026.
    expect(pacificOffsetHours(utc("2026-03-08T09:59:59Z"))).toBe(-8);
    expect(pacificOffsetHours(utc("2026-03-08T10:00:00Z"))).toBe(-7);
    expect(pacificOffsetHours(utc("2026-11-01T08:59:59Z"))).toBe(-7);
    expect(pacificOffsetHours(utc("2026-11-01T09:00:00Z"))).toBe(-8);
  });

  test("a Pacific day starts at local midnight and days are consecutive", () => {
    const sunday = pacificDay(utc("2026-11-15T20:00:00Z"));
    expect(startOfPacificDay(sunday)).toBe(utc("2026-11-15T08:00:00Z"));
    expect(pacificDay(utc("2026-11-15T07:59:59Z"))).toBe(sunday - 1);
    expect(pacificDay(utc("2026-11-16T08:00:00Z"))).toBe(sunday + 1);
    expect(startOfPacificDay(pacificDay(utc("2026-07-04T19:00:00Z")))).toBe(utc("2026-07-04T07:00:00Z"));
  });

  test("labels read in Pacific time", () => {
    expect(dayOfWeek(utc("2026-11-09T08:00:00Z"))).toBe(0);
    expect(weekdayLabel(utc("2026-11-15T20:00:00Z"))).toBe("Sun");
    expect(weekdayLabel(utc("2026-11-16T07:59:00Z"))).toBe("Sun");
    expect(clockLabel(utc("2026-11-15T22:14:00Z"))).toBe("2:14 PM");
    expect(clockLabel(utc("2026-11-15T08:05:00Z"))).toBe("12:05 AM");
    expect(clockLabel(utc("2026-11-15T20:00:00Z"))).toBe("12:00 PM");
  });
});

describe("weekStartOf and weekEndOf", () => {
  const monday = utc("2026-11-09T08:00:00Z"); // Monday 9 November 2026, 00:00 PST

  test("any instant in the week maps to its Monday midnight", () => {
    expect(weekStartOf(utc("2026-11-15T20:00:00Z"))).toBe(monday); // Sunday noon
    expect(weekStartOf(monday)).toBe(monday);
    expect(weekStartOf(monday + 7 * DAY_MS - 1)).toBe(monday);
    expect(weekStartOf(monday - 1)).toBe(monday - 7 * DAY_MS);
  });

  test("a week ends where the next one starts", () => {
    expect(weekEndOf(monday)).toBe(monday + 7 * DAY_MS);
    expect(weekStartOf(weekEndOf(monday))).toBe(weekEndOf(monday));
  });

  test("the week the clocks go back is an hour longer", () => {
    const start = utc("2026-10-26T07:00:00Z"); // Monday 00:00 PDT
    expect(weekStartOf(utc("2026-11-01T20:00:00Z"))).toBe(start); // Sunday noon PST
    expect(weekEndOf(start)).toBe(start + 7 * DAY_MS + HOUR_MS);
  });

  test("the week the clocks go forward is an hour shorter", () => {
    const start = utc("2026-03-02T08:00:00Z"); // Monday 00:00 PST
    expect(weekStartOf(utc("2026-03-08T19:00:00Z"))).toBe(start); // Sunday noon PDT
    expect(weekEndOf(start)).toBe(start + 7 * DAY_MS - HOUR_MS);
  });
});

describe("weekPairings", () => {
  const six = ["a", "b", "c", "d", "e", "f"];
  const key = ([x, y]: [string, string]) => [x, y].sort().join("");

  test("nobody to pair below two members", () => {
    expect(weekPairings([], 1)).toEqual([]);
    expect(weekPairings(["a"], 1)).toEqual([]);
    expect(weekPairings(["a", "b"], 1)).toEqual([["a", "b"]]);
  });

  test("an even league pairs everyone exactly once", () => {
    expect(weekPairings(six, 1)).toEqual([
      ["a", "f"],
      ["b", "e"],
      ["c", "d"],
    ]);
  });

  test("opponents rotate so that everyone meets everyone before a rematch", () => {
    const met = new Set<string>();
    for (let week = 1; week <= 5; week++) {
      for (const pair of weekPairings(six, week)) met.add(key(pair));
    }
    expect(met.size).toBe(15);
    expect(weekPairings(six, 6)).toEqual(weekPairings(six, 1));
  });

  test("the left-over member of an odd league gets an extra pair, last", () => {
    expect(weekPairings(["a", "b", "c"], 1)).toEqual([
      ["b", "c"],
      ["a", "b"],
    ]);
    for (let week = 1; week <= 5; week++) {
      const pairs = weekPairings(["a", "b", "c", "d", "e"], week);
      expect(pairs).toHaveLength(3);
      expect(new Set(pairs.flat()).size).toBe(5);
    }
  });
});

describe("pairsAfterJoin", () => {
  test("the second member plays the first", () => {
    expect(pairsAfterJoin([], ["a"], "b")).toEqual([["a", "b"]]);
    expect(pairsAfterJoin([], [], "a")).toEqual([]);
  });

  test("joining an even league adds an extra pair and leaves the rest alone", () => {
    expect(pairsAfterJoin([["a", "b"]], ["a", "b"], "c")).toEqual([
      ["a", "b"],
      ["c", "a"],
    ]);
  });

  test("joining an odd league gives its left-over member a real opponent", () => {
    const odd: [string, string][] = [
      ["a", "b"],
      ["c", "a"],
    ];
    expect(pairsAfterJoin(odd, ["a", "b", "c"], "d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});
