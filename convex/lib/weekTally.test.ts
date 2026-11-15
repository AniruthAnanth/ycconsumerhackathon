import { describe, expect, it } from "vitest";

import type { Id } from "../_generated/dataModel";
import { DAY_MS, HOUR_MS, weekStartOf } from "./week";
import { NO_STATS, tallyWeek, totalStats, type WeekFacts } from "./weekTally";

// Monday 9 November 2026, 00:00 in Los Angeles.
const WEEK = weekStartOf(Date.UTC(2026, 10, 11, 20));
const at = (day: number, hour = 12) => WEEK + day * DAY_MS + hour * HOUR_MS;

type Task = WeekFacts["tasks"][number];
type Proof = WeekFacts["proofs"][number];

let nextId = 0;
const id = <Table extends "tasks" | "proofs" | "drops">(table: Table) => `${table}${nextId++}` as Id<Table>;

function task(slot: Task["slot"], points: number, overrides: Partial<Task> = {}): Task {
  return { _id: id("tasks"), slot, points, status: "verified", source: "draft", ...overrides };
}
function pass(of: Task, createdAt: number, highlight = 5): Proof {
  return { _id: id("proofs"), taskId: of._id, pass: true, highlight, createdAt };
}
function facts(tasks: Task[], proofs: Proof[], extra: Partial<WeekFacts> = {}): WeekFacts {
  return { weekStart: WEEK, tasks, proofs, quickTimeOpenedAt: new Map(), adjustment: 0, ...extra };
}

describe("tallyWeek", () => {
  it("is all zeros for a week with nothing proved", () => {
    expect(tallyWeek(facts([task("body", 30, { status: "open" })], []))).toEqual({ stats: NO_STATS, activeDays: [] });
  });

  it("scores a week with the standings' rules and splits points by slot", () => {
    const gym = task("body", 40);
    const read = task("recharge", 20);
    const extra = task("flex", 15, { source: "flex" });
    const { stats, activeDays } = tallyWeek(
      facts([gym, read, extra], [pass(gym, at(0), 6), pass(read, at(1), 9), pass(extra, at(1), 3)]),
    );
    // Tasks 75, two slots cleared 50, streak 5 on Monday then 10 on Tuesday.
    expect(stats.points).toBe(75 + 50 + 15);
    expect(stats.slotsCleared).toBe(2);
    expect(stats.streak).toBe(2);
    expect(stats.tasksVerified).toBe(3);
    expect(stats.slotPoints).toEqual({ body: 40, mind: 0, recharge: 20, chores: 0, people: 0 });
    expect(activeDays).toEqual([0, 1]);
  });

  it("keeps the proof with the highest highlight as the best one", () => {
    const gym = task("body", 40);
    const read = task("recharge", 20);
    const best = pass(read, at(1), 9);
    const { stats } = tallyWeek(facts([gym, read], [pass(gym, at(0), 6), best]));
    expect(stats.bestHighlight).toBe(9);
    expect(stats.bestProofId).toBe(best._id);
  });

  it("ignores failed attempts and proofs of a task under challenge", () => {
    const gym = task("body", 40);
    const held = task("mind", 30, { status: "held" });
    const miss: Proof = { ...pass(gym, at(0), 10), pass: false };
    const { stats, activeDays } = tallyWeek(facts([gym, held], [miss, pass(gym, at(2), 4), pass(held, at(1), 8)]));
    expect(stats.tasksVerified).toBe(1);
    expect(stats.bestHighlight).toBe(4);
    expect(activeDays).toEqual([2]);
  });

  it("adds what challenges won or lost the player", () => {
    const gym = task("body", 40);
    const base = tallyWeek(facts([gym], [pass(gym, at(0))])).stats.points;
    expect(tallyWeek(facts([gym], [pass(gym, at(0))], { adjustment: -10 })).stats.points).toBe(base - 10);
  });

  it("times the response to a quick-time drop from the moment it opened", () => {
    const dropId = id("drops");
    const pushUps = task("body", 40, { source: "drop", dropId });
    const { stats } = tallyWeek(
      facts([pushUps], [pass(pushUps, at(2) + 42_000)], { quickTimeOpenedAt: new Map([[dropId, at(2)]]) }),
    );
    expect(stats.fastestQuickTimeSec).toBe(42);
    // A drop's task pays points but never clears a roster slot.
    expect(stats.slotsCleared).toBe(0);
  });

  it("replays the week as it stood before a given moment", () => {
    const gym = task("body", 40);
    const read = task("recharge", 20);
    const week = facts([gym, read], [pass(gym, at(0)), pass(read, at(3))]);
    const wednesday = tallyWeek(week, WEEK + 2 * DAY_MS);
    expect(wednesday.stats.tasksVerified).toBe(1);
    expect(wednesday.stats.slotPoints.recharge).toBe(0);
    expect(wednesday.activeDays).toEqual([0]);
    expect(tallyWeek(week).stats.points).toBeGreaterThan(wednesday.stats.points);
  });

  it("counts a verified task with no proof row at every moment", () => {
    const seeded = task("chores", 25);
    expect(tallyWeek(facts([seeded], []), WEEK).stats.tasksVerified).toBe(1);
  });
});

describe("totalStats", () => {
  it("sums weeks and keeps the best proof and fastest response", () => {
    const gym = task("body", 40);
    const read = task("recharge", 20);
    const first = tallyWeek(facts([gym], [pass(gym, at(0), 4)]));
    const second = tallyWeek(facts([read], [pass(read, at(1), 8)]));
    second.stats.fastestQuickTimeSec = 30;
    const total = totalStats([
      { weekStart: WEEK, ...first },
      { weekStart: WEEK + 7 * DAY_MS, ...second },
    ]);
    expect(total.points).toBe(first.stats.points + second.stats.points);
    expect(total.slotPoints).toEqual({ body: 40, mind: 0, recharge: 20, chores: 0, people: 0 });
    expect(total.bestHighlight).toBe(8);
    expect(total.bestProofId).toBe(second.stats.bestProofId);
    expect(total.fastestQuickTimeSec).toBe(30);
  });

  it("joins a streak across the week boundary", () => {
    const stats = NO_STATS;
    const total = totalStats([
      { weekStart: WEEK, stats, activeDays: [5, 6] },
      { weekStart: WEEK + 7 * DAY_MS, stats, activeDays: [0, 1, 3] },
    ]);
    expect(total.streak).toBe(4);
  });

  it("is all zeros for no weeks", () => {
    expect(totalStats([])).toEqual(NO_STATS);
  });
});
