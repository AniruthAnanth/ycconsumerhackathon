import { describe, expect, it } from "vitest";

import { revealedText, transcriptWords } from "./transcriptReveal";

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
