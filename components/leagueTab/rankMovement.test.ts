import { describe, expect, it } from "vitest";

import { rankMovement, withBaseline } from "./rankMovement";

const rows = (...ids: string[]) => ids.map((userId, i) => ({ userId, rank: i + 1 }));

describe("rank movement", () => {
  it("shows nothing on the first render", () => {
    const baseline = withBaseline({}, rows("a", "b", "c"));
    expect(rows("a", "b", "c").map((row) => rankMovement(baseline, row))).toEqual([0, 0, 0]);
  });

  it("counts places gained and lost since the first render", () => {
    const baseline = withBaseline({}, rows("a", "b", "c"));
    expect(rows("c", "a", "b").map((row) => rankMovement(baseline, row))).toEqual([2, -1, -1]);
  });

  it("keeps the first rank for a known player and adds a newcomer", () => {
    const first = withBaseline({}, rows("a", "b"));
    const next = withBaseline(first, rows("b", "a", "c"));
    expect(next).toEqual({ a: 1, b: 2, c: 3 });
    expect(withBaseline(first, rows("b", "a"))).toBe(first);
  });
});
