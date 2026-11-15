import { describe, expect, it } from "vitest";

import { lineupProblem, tidyTask } from "@/convex/lib/lineupRules";
import { SLOT_ORDER } from "@/lib/slots";

import { canLock, canRemoveTask } from "./lineupEdit";
import { MANUAL_TASK_POINTS, manualLineup } from "./manualLineup";

describe("manualLineup", () => {
  it("offers one suggested row for each slot, in roster order, at the default points", () => {
    const tasks = manualLineup();
    expect(tasks.map((task) => task.slot)).toEqual(SLOT_ORDER);
    expect(tasks.every((task) => task.points === MANUAL_TASK_POINTS && task.proofType === "photo")).toBe(true);
  });

  it("keeps every suggestion short enough for the row's single line", () => {
    for (const task of manualLineup()) {
      expect(task.title.length).toBeGreaterThan(0);
      expect(task.title.length).toBeLessThanOrEqual(20);
    }
  });

  it("can be locked as it stands, by the app's rule and by the server's", () => {
    const tasks = manualLineup();
    expect(canLock(tasks)).toBe(true);
    // lineup.lock tidies each task and then looks for a problem; neither step finds anything to do.
    expect(tasks.map(tidyTask)).toEqual(tasks);
    expect(lineupProblem(tasks)).toBeNull();
  });

  it("lets the player drop the flex row and nothing else", () => {
    expect(manualLineup().filter(canRemoveTask).map((task) => task.slot)).toEqual(["flex"]);
  });

  it("hands out a fresh list each time, so one visit's edits never leak into the next", () => {
    expect(manualLineup()).not.toBe(manualLineup());
  });
});
