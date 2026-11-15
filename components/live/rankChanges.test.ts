import { describe, expect, it } from "vitest";

import { rankChanges, ranksOf } from "./rankChanges";

describe("rankChanges", () => {
  it("moves nobody on the first table", () => {
    expect(rankChanges(undefined, [{ userId: "a", rank: 1 }]).size).toBe(0);
  });

  it("names the players whose rank changed", () => {
    const before = ranksOf([
      { userId: "a", rank: 1 },
      { userId: "b", rank: 2 },
      { userId: "c", rank: 3 },
    ]);
    const after = [
      { userId: "b", rank: 1 },
      { userId: "a", rank: 2 },
      { userId: "c", rank: 3 },
    ];
    expect([...rankChanges(before, after)].sort()).toEqual(["a", "b"]);
  });

  it("does not flash a player who just joined", () => {
    expect(rankChanges({ a: 1 }, [{ userId: "a", rank: 1 }, { userId: "n", rank: 2 }]).size).toBe(0);
  });
});
