import { describe, expect, it } from "vitest";
import {
  CORE_SLOTS,
  clampTaskPoints,
  lineupProblem,
  shapeDraft,
  tidyTask,
  type DraftTask,
  type Slot,
} from "./lineupRules";

function task(slot: Slot, title: string, overrides: Partial<DraftTask> = {}): DraftTask {
  return { slot, title, points: 30, proofType: "photo", ...overrides };
}

const fullLineup = [
  task("body", "Leg day at the gym"),
  task("mind", "Finish OS problem set"),
  task("recharge", "Read for 30 minutes"),
  task("chores", "Do laundry"),
  task("people", "Dinner with Maya"),
];

describe("clampTaskPoints", () => {
  it("keeps points within 10 to 50", () => {
    expect(clampTaskPoints(2)).toBe(10);
    expect(clampTaskPoints(10)).toBe(10);
    expect(clampTaskPoints(50)).toBe(50);
    expect(clampTaskPoints(400)).toBe(50);
  });

  it("rounds to steps of 5", () => {
    expect(clampTaskPoints(32)).toBe(30);
    expect(clampTaskPoints(33)).toBe(35);
  });

  it("falls back to the minimum for a non-number", () => {
    expect(clampTaskPoints(Number.NaN)).toBe(10);
  });
});

describe("tidyTask", () => {
  it("trims the title and clamps the points", () => {
    expect(tidyTask(task("body", "  Leg   day ", { points: 75 }))).toEqual(task("body", "Leg day", { points: 50 }));
  });

  it("keeps the place on a location task", () => {
    const place = { name: "YC office", lat: 37.7609, lng: -122.3862 };
    expect(tidyTask(task("mind", "Check in at YC", { proofType: "photo_location", place }))).toMatchObject({
      proofType: "photo_location",
      place,
    });
  });

  it("turns a location task with no usable place into a photo task", () => {
    expect(tidyTask(task("mind", "Check in at YC", { proofType: "photo_location" })).proofType).toBe("photo");
    const badPlace = { name: "Nowhere", lat: 137, lng: 0 };
    const tidy = tidyTask(task("mind", "Check in", { proofType: "photo_location", place: badPlace }));
    expect(tidy.proofType).toBe("photo");
    expect(tidy.place).toBeUndefined();
  });

  it("drops a place from a plain photo task", () => {
    const place = { name: "Dolores Park", lat: 37.7596, lng: -122.4269 };
    expect(tidyTask(task("body", "Run", { place })).place).toBeUndefined();
  });
});

describe("shapeDraft", () => {
  it("returns the five core slots in roster order", () => {
    const shuffled = [fullLineup[3], fullLineup[0], fullLineup[4], fullLineup[2], fullLineup[1]];
    expect(shapeDraft(shuffled).map((t) => t.slot)).toEqual([...CORE_SLOTS]);
  });

  it("fills a slot the model left empty", () => {
    const withoutPeople = fullLineup.filter((t) => t.slot !== "people");
    const shaped = shapeDraft(withoutPeople);
    expect(shaped).toHaveLength(5);
    expect(shaped[4]).toMatchObject({ slot: "people", proofType: "photo" });
    expect(shaped[4].points).toBeGreaterThanOrEqual(10);
  });

  it("moves a second task for a filled slot to flex", () => {
    const shaped = shapeDraft([...fullLineup, task("body", "Evening run")]);
    expect(shaped).toHaveLength(6);
    expect(shaped[0].title).toBe("Leg day at the gym");
    expect(shaped[5]).toMatchObject({ slot: "flex", title: "Evening run" });
  });

  it("never returns more than eight tasks or three flex tasks", () => {
    const extras = ["A", "B", "C", "D", "E"].map((title) => task("flex", title));
    const shaped = shapeDraft([...fullLineup, ...extras]);
    expect(shaped).toHaveLength(8);
    expect(shaped.filter((t) => t.slot === "flex").map((t) => t.title)).toEqual(["A", "B", "C"]);
  });

  it("clamps every task's points into 10 to 50", () => {
    const shaped = shapeDraft(fullLineup.map((t, i) => ({ ...t, points: i * 30 })));
    for (const t of shaped) {
      expect(t.points).toBeGreaterThanOrEqual(10);
      expect(t.points).toBeLessThanOrEqual(50);
    }
  });

  it("drops tasks with no title", () => {
    expect(shapeDraft([...fullLineup, task("flex", "   ")])).toHaveLength(5);
  });

  it("builds a full lineup even from nothing", () => {
    const shaped = shapeDraft([]);
    expect(shaped.map((t) => t.slot)).toEqual([...CORE_SLOTS]);
    expect(lineupProblem(shaped)).toBeNull();
  });
});

describe("lineupProblem", () => {
  it("accepts five core tasks, with or without flex", () => {
    expect(lineupProblem(fullLineup)).toBeNull();
    expect(lineupProblem([...fullLineup, task("flex", "Meal prep")])).toBeNull();
  });

  it("names the missing slot", () => {
    expect(lineupProblem(fullLineup.filter((t) => t.slot !== "body"))).toBe("Add a Body task to lock your lineup.");
  });

  it("refuses two tasks in one core slot", () => {
    expect(lineupProblem([...fullLineup, task("mind", "Ship a PR")])).toContain("Only one Mind task");
  });

  it("refuses more than three flex tasks", () => {
    const flex = ["A", "B", "C", "D"].map((title) => task("flex", title));
    expect(lineupProblem([...fullLineup, ...flex])).toBe("A lineup holds at most 3 flex tasks.");
  });

  it("refuses an empty title", () => {
    expect(lineupProblem([...fullLineup.slice(1), task("body", "")])).toBe("Every task needs a title.");
  });
});
