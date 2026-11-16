import { describe, expect, test } from "vitest";

import { marketQuestions, potNeedsLine } from "./marketQuestions";
import type { Market } from "./useMarket";

const row = (name: string, chance: number, finishChance: number, isMe = false) =>
  ({ userId: name, name, isMe, chance, finishChance, projected: 100 }) as Market["odds"]["rows"][number];

const market = (overrides: Partial<Market> = {}) =>
  ({
    matchup: { opponentName: "Ava Kim", chance: 0.62 },
    odds: { kind: "pot", potUsd: 120, nobody: 0, rows: [row("Maya Chen", 0.9, 1), row("Sam Patel", 0.08, 0.3), row("Priya Shah", 0.02, 0.55, true)] },
    ...overrides,
  }) as unknown as Market;

describe("marketQuestions", () => {
  test("asks who wins the pot, whether you beat your opponent, and who is closest to clearing all 5", () => {
    expect(marketQuestions(market()).map(({ question, answer, note }) => [question, answer, note])).toEqual([
      ["Who wins the pot?", "Maya Chen", "90% favourite"],
      ["Will you beat Ava Kim?", "Yes", "62% chance"],
      ["Will you clear all 5?", "Yes", "55% chance"],
    ]);
  });

  test("a free league asks who tops the week, and no matchup drops that card", () => {
    const free = market({ matchup: null, odds: { kind: "week", potUsd: 0, nobody: 0, rows: [row("Ada", 0.5, 0.2, true), row("Bo", 0.5, 0.1)] } } as Partial<Market>);
    expect(marketQuestions(free).map((q) => q.question)).toEqual(["Who tops the week?", "Will you clear all 5?"]);
    expect(marketQuestions(free)[0].answer).toBe("You");
  });
});

describe("potNeedsLine", () => {
  test("says how far from the pot you are", () => {
    expect(potNeedsLine(2)).toBe("The pot needs all 5 slots cleared — you've cleared 2.");
    expect(potNeedsLine(5)).toBe("You've cleared all 5 slots, so you're in the running for the pot.");
  });
});
