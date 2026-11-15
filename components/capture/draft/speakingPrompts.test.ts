import { describe, expect, it } from "vitest";

import { promptAt, SPEAKING_PROMPTS } from "./speakingPrompts";

describe("promptAt", () => {
  it("starts on the first example and takes them in order", () => {
    expect(SPEAKING_PROMPTS.map((_, turn) => promptAt(turn))).toEqual([...SPEAKING_PROMPTS]);
  });

  it("wraps around after the last one", () => {
    expect(promptAt(SPEAKING_PROMPTS.length)).toBe(SPEAKING_PROMPTS[0]);
    expect(promptAt(SPEAKING_PROMPTS.length * 4 + 1)).toBe(SPEAKING_PROMPTS[1]);
  });

  it("offers two or three examples, each short enough to read at a glance", () => {
    expect(SPEAKING_PROMPTS.length).toBeGreaterThanOrEqual(2);
    expect(SPEAKING_PROMPTS.length).toBeLessThanOrEqual(3);
    for (const prompt of SPEAKING_PROMPTS) expect(prompt.length).toBeLessThanOrEqual(110);
  });
});
