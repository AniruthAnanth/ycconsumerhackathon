import { describe, expect, it } from "vitest";

import type { Task } from "./backend";
import { flexTasksLeft, pickBannerDrop, splitRoster } from "./roster";

function task(taskId: string, slot: Task["slot"], source: Task["source"] = "draft"): Task {
  return {
    taskId: taskId as Task["taskId"],
    slot,
    title: taskId,
    points: 30,
    proofType: "photo",
    status: "open",
    source,
    score: null,
    dueLabel: "Due Sun",
    upNext: false,
  };
}

describe("splitRoster", () => {
  it("lists the five slots in roster order, empty where nothing is drafted", () => {
    const { starters, extras } = splitRoster([task("read", "recharge"), task("gym", "body")]);
    expect(starters.map((starter) => [starter.slot, starter.task?.taskId])).toEqual([
      ["body", "gym"],
      ["mind", undefined],
      ["recharge", "read"],
      ["chores", undefined],
      ["people", undefined],
    ]);
    expect(extras).toEqual([]);
  });

  it("keeps flex tasks and drop tasks out of the starter slots", () => {
    const rows = [task("gym", "body"), task("pushups", "body", "drop"), task("stretch", "flex", "flex")];
    const { starters, extras } = splitRoster(rows);
    expect(starters[0]!.task?.taskId).toBe("gym");
    expect(extras.map((row) => row.taskId)).toEqual(["pushups", "stretch"]);
  });

  it("does not promote a drop task into an undrafted slot", () => {
    const { starters, extras } = splitRoster([task("pushups", "body", "drop")]);
    expect(starters[0]!.task).toBeUndefined();
    expect(extras.map((row) => row.taskId)).toEqual(["pushups"]);
  });
});

describe("flexTasksLeft", () => {
  it("counts down from three as flex tasks are added, whatever their source", () => {
    expect(flexTasksLeft([task("gym", "body")])).toBe(3);
    expect(flexTasksLeft([task("stretch", "flex", "flex"), task("walk", "flex")])).toBe(1);
  });

  it("is zero at the limit and never negative", () => {
    const flex = ["a", "b", "c", "d"].map((id) => task(id, "flex", "flex"));
    expect(flexTasksLeft(flex.slice(0, 3))).toBe(0);
    expect(flexTasksLeft(flex)).toBe(0);
  });
});

describe("pickBannerDrop", () => {
  const now = 1_000_000;
  const taskId = "task" as Task["taskId"];

  it("prefers a quick-time drop over a mystery task or a group session", () => {
    const drops = [
      { kind: "group" as const, closesAt: now + 10 },
      { kind: "mystery" as const, closesAt: now + 20 },
      { kind: "quicktime" as const, closesAt: now + 30 },
    ];
    expect(pickBannerDrop(drops, now)?.kind).toBe("quicktime");
  });

  it("puts a group session whose check-in is open above a mystery task", () => {
    const drops = [
      { kind: "mystery" as const, closesAt: now + 10 },
      { kind: "group" as const, closesAt: now + 20, taskId },
    ];
    expect(pickBannerDrop(drops, now)?.kind).toBe("group");
  });

  it("keeps a session that is still gathering RSVPs behind a mystery task", () => {
    const drops = [
      { kind: "group" as const, closesAt: now + 10 },
      { kind: "mystery" as const, closesAt: now + 20, taskId },
    ];
    expect(pickBannerDrop(drops, now)?.kind).toBe("mystery");
  });

  it("takes the one closing soonest within a kind", () => {
    const drops = [
      { kind: "group" as const, closesAt: now + 50 },
      { kind: "group" as const, closesAt: now + 5 },
    ];
    expect(pickBannerDrop(drops, now)?.closesAt).toBe(now + 5);
  });

  it("ignores drops that have already closed", () => {
    expect(pickBannerDrop([{ kind: "quicktime" as const, closesAt: now }], now)).toBeUndefined();
    expect(pickBannerDrop([], now)).toBeUndefined();
  });
});
