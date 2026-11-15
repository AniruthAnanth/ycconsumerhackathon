import { describe, expect, it } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";

import { arrivalKey, roundCoordinate } from "./coords";

const task = "task1" as Id<"tasks">;

describe("roundCoordinate", () => {
  it("keeps four decimals so GPS jitter collapses to one value", () => {
    expect(roundCoordinate(37.76091234)).toBe(37.7609);
    expect(roundCoordinate(-122.38844999)).toBe(-122.3884);
    expect(roundCoordinate(37.76088)).toBe(37.7609);
  });
});

describe("arrivalKey", () => {
  it("is the same for the same task and position", () => {
    expect(arrivalKey(task, 37.7609, -122.3884)).toBe(arrivalKey(task, 37.7609, -122.3884));
  });

  it("changes with a new fix or a different task", () => {
    expect(arrivalKey(task, 37.7609, -122.3884)).not.toBe(arrivalKey(task, 37.761, -122.3884));
    expect(arrivalKey(task, 37.7609, -122.3884)).not.toBe(arrivalKey("task2" as Id<"tasks">, 37.7609, -122.3884));
  });
});
