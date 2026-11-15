import { describe, expect, it } from "vitest";

import type { Verdict } from "@/components/capture/backend";

import { initialPhase, nextPhase } from "./verdictPhase";

const verdict: Verdict = {
  pass: false,
  confidence: 0.4,
  reason: "Too dark to tell.",
  highlight: 0,
  caption: "",
  points: 0,
  closeCall: true,
};

describe("nextPhase", () => {
  it("starts reviewing", () => {
    expect(initialPhase).toEqual({ name: "reviewing" });
  });

  it("moves from reviewing to the verdict", () => {
    expect(nextPhase(initialPhase, { type: "verdict", verdict })).toEqual({ name: "verdict", verdict });
  });

  it("moves from reviewing to the error with its message", () => {
    expect(nextPhase(initialPhase, { type: "failure", message: "Offline" })).toEqual({
      name: "error",
      message: "Offline",
    });
  });

  it("returns to reviewing when the player retries after an error", () => {
    expect(nextPhase({ name: "error", message: "Offline" }, { type: "submit" })).toEqual(initialPhase);
  });

  it("ignores a result that arrives outside a submission", () => {
    const shown = nextPhase(initialPhase, { type: "verdict", verdict });
    expect(nextPhase(shown, { type: "failure", message: "Late" })).toBe(shown);
    const failed = nextPhase(initialPhase, { type: "failure", message: "Offline" });
    expect(nextPhase(failed, { type: "verdict", verdict })).toBe(failed);
  });

  it("returns to reviewing when a failed verdict is checked again", () => {
    const shown = nextPhase(initialPhase, { type: "verdict", verdict });
    expect(nextPhase(shown, { type: "submit" })).toEqual(initialPhase);
  });
});
