import { describe, expect, it } from "vitest";

import { REVEAL_CAP_MS, REVEAL_INTERVAL_MS, revealedText, transcriptWords, wordsRevealed } from "./transcriptReveal";

describe("transcriptWords", () => {
  it("splits on any whitespace and drops empties", () => {
    expect(transcriptWords("  leg day\n and  a run ")).toEqual(["leg", "day", "and", "a", "run"]);
    expect(transcriptWords("")).toEqual([]);
  });
});

describe("revealedText", () => {
  it("shows the first n words", () => {
    const words = ["leg", "day", "and", "a", "run"];
    expect(revealedText(words, 0)).toBe("");
    expect(revealedText(words, 3)).toBe("leg day and");
    expect(revealedText(words, 99)).toBe("leg day and a run");
  });
});

describe("wordsRevealed", () => {
  it("types a short transcript one word per interval", () => {
    expect(wordsRevealed(5, 0)).toBe(0);
    expect(wordsRevealed(5, 2 * REVEAL_INTERVAL_MS)).toBe(2);
    expect(wordsRevealed(5, 5 * REVEAL_INTERVAL_MS)).toBe(5);
  });

  it("finishes a long transcript at the cap, not at one word per interval", () => {
    const words = 200;
    expect(words * REVEAL_INTERVAL_MS).toBeGreaterThan(REVEAL_CAP_MS);
    expect(wordsRevealed(words, REVEAL_CAP_MS / 2)).toBe(words / 2);
    expect(wordsRevealed(words, REVEAL_CAP_MS)).toBe(words);
  });

  it("is finished after one late tick, however few ticks there were", () => {
    expect(wordsRevealed(58, 1000)).toBe(58);
    expect(wordsRevealed(58, 60_000)).toBe(58);
  });

  it("has nothing to type for an empty transcript", () => {
    expect(wordsRevealed(0, 0)).toBe(0);
  });
});
