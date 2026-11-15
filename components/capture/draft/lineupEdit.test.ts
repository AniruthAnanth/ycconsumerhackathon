import { describe, expect, it } from "vitest";

import { canLock, canRemoveTask, removeTask, renameTask, tasksToLock } from "./lineupEdit";
import type { DraftTask } from "../backend";

const body: DraftTask = { slot: "body", title: "Leg day", points: 10, proofType: "photo_location" };
const flex: DraftTask = { slot: "flex", title: "5k run", points: 5, proofType: "photo" };

describe("renameTask", () => {
  it("changes only the title of the chosen row", () => {
    expect(renameTask([body, flex], 1, "10k run")).toEqual([body, { ...flex, title: "10k run" }]);
  });
});

describe("removeTask", () => {
  it("removes a flex row", () => {
    expect(removeTask([body, flex], 1)).toEqual([body]);
  });

  it("keeps the five core slot rows", () => {
    const tasks = [body, flex];
    expect(removeTask(tasks, 0)).toBe(tasks);
    expect(canRemoveTask(body)).toBe(false);
    expect(canRemoveTask(flex)).toBe(true);
  });

  it("ignores an index that does not exist", () => {
    const tasks = [body];
    expect(removeTask(tasks, 4)).toBe(tasks);
  });
});

describe("canLock", () => {
  it("needs at least one task", () => {
    expect(canLock([])).toBe(false);
  });

  it("rejects an empty or blank title", () => {
    expect(canLock([body, { ...flex, title: "" }])).toBe(false);
    expect(canLock([body, { ...flex, title: "   " }])).toBe(false);
  });

  it("accepts a lineup where every row has a title", () => {
    expect(canLock([body, flex])).toBe(true);
  });
});

describe("tasksToLock", () => {
  it("trims titles", () => {
    expect(tasksToLock([{ ...body, title: "  Leg day " }])).toEqual([body]);
  });
});
