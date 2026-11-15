import { describe, expect, it } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";

import { widgetSnapshot } from "./widgetSnapshot";

const userId = (id: string) => id as Id<"users">;

const table = [
  { rank: 1, userId: userId("maya"), name: "Maya", slotsCleared: 4, points: 180, streak: 3, paid: true },
  { rank: 2, userId: userId("me"), name: "Sam", slotsCleared: 3, points: 142.5, streak: 1, paid: true },
  { rank: 3, userId: userId("jo"), name: "Jo", slotsCleared: 1, points: 40, streak: 0, paid: false },
];

const roster = [
  { title: "Leg day at the gym", points: 30, status: "verified", upNext: false },
  { title: "Read 20 pages", points: 24.6, status: "open", upNext: true },
  { title: "Call grandma", points: 20, status: "open", upNext: false },
] as const;

describe("widgetSnapshot", () => {
  it("shows my row of the table and the task marked up next, in whole numbers", () => {
    expect(widgetSnapshot({ leagueName: "Sunday League", table, meId: userId("me"), roster })).toEqual({
      leagueName: "Sunday League",
      rank: 2,
      memberCount: 3,
      points: 143,
      slotsCleared: 3,
      slotsTotal: 5,
      nextTaskTitle: "Read 20 pages",
      nextTaskPoints: 25,
    });
  });

  it("is null when I have no row in the table, so the widget keeps what it had", () => {
    expect(widgetSnapshot({ leagueName: "Sunday League", table, meId: userId("stranger"), roster })).toBeNull();
  });

  it("leaves the next task empty when nothing is up next", () => {
    const allDone = roster.map((task) => ({ ...task, status: "verified", upNext: false }));
    const done = widgetSnapshot({ leagueName: "Sunday League", table, meId: userId("me"), roster: allDone });
    expect(done).toMatchObject({ nextTaskTitle: "", nextTaskPoints: 0 });
    // Nothing drafted reads the same way: the widget says "No open tasks" for both.
    const empty = widgetSnapshot({ leagueName: "Sunday League", table, meId: userId("me"), roster: [] });
    expect(empty).toMatchObject({ rank: 2, nextTaskTitle: "", nextTaskPoints: 0 });
  });
});
