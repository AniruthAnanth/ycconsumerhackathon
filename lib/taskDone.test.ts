import { describe, expect, it } from "vitest";

import { formatGain, isDone, isPerfectWeek, justDone, tickTimes } from "./taskDone";

describe("isDone", () => {
  it("is true only for a verified task", () => {
    expect(isDone("verified")).toBe(true);
    expect(isDone("held")).toBe(false);
    expect(isDone("open")).toBe(false);
    expect(isDone("failed")).toBe(false);
    expect(isDone(undefined)).toBe(false);
  });
});

describe("justDone", () => {
  it("fires on the change into verified and never for a task that was already done", () => {
    expect(justDone("open", "verified")).toBe(true);
    expect(justDone("held", "verified")).toBe(true);
    expect(justDone("verified", "verified")).toBe(false);
    expect(justDone("verified", "held")).toBe(false);
    expect(justDone("open", "held")).toBe(false);
  });
});

describe("isPerfectWeek", () => {
  const starters = (["body", "mind", "recharge", "chores", "people"] as const).map((slot) => ({ slot, status: "verified" }));

  it("needs all five starter slots verified", () => {
    expect(isPerfectWeek(starters)).toBe(true);
    expect(isPerfectWeek(starters.slice(1))).toBe(false);
    expect(isPerfectWeek([...starters.slice(1), { slot: "body", status: "held" }])).toBe(false);
  });

  it("ignores flex", () => {
    expect(isPerfectWeek([...starters.slice(1), { slot: "flex", status: "verified" }])).toBe(false);
  });
});

describe("formatGain", () => {
  it("signs the points", () => {
    expect(formatGain(30)).toBe("+30");
    expect(formatGain(12.5)).toBe("+12.5");
  });
});

describe("tickTimes", () => {
  it("ticks once per point up to the cap, spread over the count", () => {
    expect(tickTimes(30, 600, 6)).toEqual([0, 100, 200, 300, 400, 500]);
    expect(tickTimes(2, 600, 6)).toEqual([0, 300]);
    expect(tickTimes(-3, 300, 6)).toEqual([0, 100, 200]);
  });

  it("stays silent when nothing changed", () => {
    expect(tickTimes(0, 600, 6)).toEqual([]);
  });
});
