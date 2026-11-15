import { describe, expect, it } from "vitest";

import type { Matchup, TaskRow } from "@/components/social/contract";

import type { Drop } from "./backend";
import { activityFor, dropState, matchupState } from "./liveActivityState";

const NOW = 1_000_000;
const WEEK_ENDS = 9_000_000.4;
const league = { leagueName: "YC Hackathon", weekEndsAtMs: WEEK_ENDS };

const drop = (over: Partial<Drop> = {}) =>
  ({
    dropId: "d1",
    kind: "quicktime",
    title: "20 push-ups",
    slot: "body",
    points: 40,
    gesture: "peace sign",
    opensAt: NOW - 1000,
    closesAt: NOW + 60_000,
    taskId: "t1",
    ...over,
  }) as Drop;

const task = (status: TaskRow["status"]) => ({ status }) as TaskRow;

const matchup = {
  me: { userId: "u1", name: "Sam Rivera", total: 120.6, winProbability: 0.6, slotsCleared: 3 },
  opponent: { userId: "u2", name: "Maya", total: 98.2, winProbability: 0.4, slotsCleared: 1 },
  rows: [
    { slot: "body", mine: task("verified") },
    { slot: "mind", mine: task("open") },
    { slot: "recharge" },
    { slot: "chores", mine: task("verified") },
    { slot: "people", mine: task("held") },
    { slot: "flex", mine: task("verified") },
  ],
} as unknown as Matchup;

const ctx = (over = {}) => ({ drops: [], matchup: null, now: NOW, ...league, ...over });

describe("matchupState", () => {
  it("rounds every number, uses first names and reports the server's slot count", () => {
    expect(matchupState(matchup, league)).toEqual({
      kind: "matchup",
      leagueName: "YC Hackathon",
      title: "",
      gesture: "",
      points: 0,
      endsAtMs: 9_000_000,
      myName: "Sam",
      opponentName: "Maya",
      myScore: 121,
      opponentScore: 98,
      slotsCleared: 3,
      slotsTotal: 5,
    });
  });
});

describe("dropState", () => {
  it("carries the scoreboard so the expanded island still shows the score", () => {
    const state = dropState(drop(), { leagueName: "YC Hackathon", matchup });
    expect(state).toMatchObject({ kind: "drop", title: "20 push-ups", gesture: "peace sign", points: 40, endsAtMs: NOW + 60_000 });
    expect(state).toMatchObject({ myScore: 121, opponentScore: 98, slotsCleared: 3 });
  });

  it("uses an empty gesture when the drop has none, and zeros without a matchup", () => {
    const state = dropState(drop({ gesture: undefined, points: 39.6 }), { leagueName: "L", matchup: null });
    expect(state.gesture).toBe("");
    expect(state.points).toBe(40);
    expect(state).toMatchObject({ myName: "", opponentName: "", myScore: 0, opponentScore: 0, slotsCleared: 0, slotsTotal: 5 });
  });
});

describe("activityFor", () => {
  it("prefers the soonest-closing live quick-time drop over the matchup", () => {
    const later = drop({ dropId: "d2" as Drop["dropId"], title: "Later", closesAt: NOW + 120_000 });
    const sooner = drop({ title: "Sooner", closesAt: NOW + 30_000 });
    expect(activityFor(ctx({ drops: [later, sooner], matchup }))?.title).toBe("Sooner");
  });

  it("skips a drop that has closed", () => {
    expect(activityFor(ctx({ drops: [drop({ closesAt: NOW })], matchup }))?.kind).toBe("matchup");
  });

  it("ignores group drops", () => {
    expect(activityFor(ctx({ drops: [drop({ kind: "group" })], matchup }))?.kind).toBe("matchup");
  });

  it("is null with no live drop and no matchup", () => {
    expect(activityFor(ctx())).toBeNull();
    expect(activityFor(ctx({ drops: [drop({ closesAt: NOW - 1 })] }))).toBeNull();
  });
});
