import { describe, expect, it } from "vitest";

import type { Task } from "./backend";
import { flexTasksLeft, pickBannerDrop, splitRoster, weekActions } from "./roster";

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

describe("weekActions", () => {
  const thisWeek = 1_000;
  const lastWeek = 400;
  const nextWeek = 1_600;
  const drafted = [task("gym", "body"), task("stretch", "flex", "flex")];

  it("offers the draft for the week in play while nothing is drafted", () => {
    const actions = weekActions({ roster: { locked: false, rows: [] }, shownWeekStart: undefined, currentWeekStart: thisWeek });
    expect(actions).toEqual({ canDraft: true, noLineup: false, undrafted: true, takesFlex: false });
  });

  it("offers flex tasks on a locked lineup in the week in play, until it holds three", () => {
    const week = { shownWeekStart: undefined, currentWeekStart: thisWeek };
    expect(weekActions({ ...week, roster: { locked: true, rows: drafted } }).takesFlex).toBe(true);
    const full = ["a", "b", "c"].map((id) => task(id, "flex", "flex"));
    expect(weekActions({ ...week, roster: { locked: true, rows: full } }).takesFlex).toBe(false);
    expect(weekActions({ ...week, roster: { locked: false, rows: drafted } }).takesFlex).toBe(false);
  });

  it("never offers the draft or a flex task on a week that has ended", () => {
    const week = { shownWeekStart: lastWeek, currentWeekStart: thisWeek };
    expect(weekActions({ ...week, roster: { locked: false, rows: [] } })).toEqual({
      canDraft: false,
      noLineup: true,
      undrafted: false,
      takesFlex: false,
    });
    expect(weekActions({ ...week, roster: { locked: true, rows: drafted } })).toEqual({
      canDraft: false,
      noLineup: false,
      undrafted: false,
      takesFlex: false,
    });
  });

  it("offers the draft for next week but adds no flex task to it", () => {
    const week = { shownWeekStart: nextWeek, currentWeekStart: thisWeek };
    expect(weekActions({ ...week, roster: { locked: false, rows: [] } }).undrafted).toBe(true);
    expect(weekActions({ ...week, roster: { locked: true, rows: drafted } }).takesFlex).toBe(false);
  });

  it("offers nothing but the draft while the roster or the league loads", () => {
    expect(weekActions({ roster: undefined, shownWeekStart: undefined, currentWeekStart: undefined })).toEqual({
      canDraft: true,
      noLineup: false,
      undrafted: false,
      takesFlex: false,
    });
  });
});

describe("pickBannerDrop", () => {
  const now = 1_000_000;
  const taskId = "task" as Task["taskId"];

  it("prefers a quick-time drop over a group session", () => {
    const drops = [
      { kind: "group" as const, closesAt: now + 10, taskId },
      { kind: "quicktime" as const, closesAt: now + 30 },
    ];
    expect(pickBannerDrop(drops, now)?.kind).toBe("quicktime");
  });

  it("puts a group session whose check-in is open above one still gathering RSVPs", () => {
    const drops = [
      { kind: "group" as const, closesAt: now + 10 },
      { kind: "group" as const, closesAt: now + 20, taskId },
    ];
    expect(pickBannerDrop(drops, now)?.taskId).toBe(taskId);
  });

  it("ignores a drop of a kind it does not know", () => {
    const unknown = "something new" as never;
    expect(pickBannerDrop([{ kind: unknown, closesAt: now + 10 }], now)).toBeUndefined();
    expect(pickBannerDrop([{ kind: unknown, closesAt: now + 10 }, { kind: "group" as const, closesAt: now + 20 }], now)?.kind).toBe("group");
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
