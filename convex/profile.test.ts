// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

import { bestSlot, calendarDay, completionRate, fastestResponseSec, pointsByWeek, streaks } from "./profile";

const modules = import.meta.glob("./**/*.ts");

const DAY = 24 * 60 * 60 * 1000;
// Monday 9 Nov 2026 00:00 in Los Angeles (PST, UTC-8).
const WEEK = Date.UTC(2026, 10, 9, 8);

describe("completionRate", () => {
  it("is the share of tasks that are verified", () => {
    const tasks = [{ status: "verified" }, { status: "open" }, { status: "failed" }, { status: "verified" }] as const;
    expect(completionRate([...tasks])).toBe(0.5);
  });
  it("does not count a held task: its proof is under challenge", () => {
    expect(completionRate([{ status: "held" }, { status: "verified" }])).toBe(0.5);
  });
  it("is 0 for a player with no tasks", () => {
    expect(completionRate([])).toBe(0);
  });
});

describe("bestSlot", () => {
  it("picks the slot cleared most often", () => {
    expect(
      bestSlot([
        { slot: "body", status: "verified", points: 20 },
        { slot: "body", status: "verified", points: 20 },
        { slot: "mind", status: "verified", points: 50 },
        { slot: "chores", status: "open", points: 50 },
      ]),
    ).toBe("body");
  });
  it("breaks a tie by points earned", () => {
    expect(
      bestSlot([
        { slot: "body", status: "verified", points: 20 },
        { slot: "mind", status: "verified", points: 40 },
      ]),
    ).toBe("mind");
  });
  it("lets flex win only when nothing else is done", () => {
    const flex = { slot: "flex", status: "verified", points: 50 } as const;
    expect(bestSlot([flex, flex, { slot: "people", status: "verified", points: 10 }])).toBe("people");
    expect(bestSlot([flex])).toBe("flex");
  });
  it("is null before the first verified task", () => {
    expect(bestSlot([{ slot: "body", status: "open", points: 20 }])).toBeNull();
  });
});

describe("calendarDay", () => {
  it("gives consecutive numbers to consecutive Los Angeles days", () => {
    const monday = calendarDay(WEEK + 10 * 60 * 60 * 1000, WEEK);
    expect(calendarDay(WEEK + DAY - 1, WEEK)).toBe(monday);
    expect(calendarDay(WEEK + DAY, WEEK)).toBe(monday + 1);
    expect(calendarDay(WEEK + 6 * DAY + 1, WEEK)).toBe(monday + 6);
  });
  it("continues across weeks, so Sunday and the next Monday are neighbours", () => {
    const sunday = calendarDay(WEEK + 6.5 * DAY, WEEK);
    const nextMonday = calendarDay(WEEK + 7.5 * DAY, WEEK + 7 * DAY);
    expect(nextMonday).toBe(sunday + 1);
  });
  it("stays consecutive across the daylight-saving change", () => {
    // Monday 26 Oct 2026 is still PDT (UTC-7); Monday 2 Nov 2026 is PST (UTC-8).
    const pdtWeek = Date.UTC(2026, 9, 26, 7);
    const pstWeek = Date.UTC(2026, 10, 2, 8);
    expect(calendarDay(pstWeek + 1, pstWeek)).toBe(calendarDay(pdtWeek + 1, pdtWeek) + 7);
  });
});

describe("streaks", () => {
  it("counts the run that ends today", () => {
    expect(streaks([10, 11, 12], 12)).toEqual({ current: 3, longest: 3 });
  });
  it("keeps the streak alive when the last proof was yesterday", () => {
    expect(streaks([10, 11], 12)).toEqual({ current: 2, longest: 2 });
  });
  it("ends the current streak after a missed day, but remembers the longest", () => {
    expect(streaks([1, 2, 3, 4, 8], 10)).toEqual({ current: 0, longest: 4 });
  });
  it("counts a day once however many proofs it has", () => {
    expect(streaks([5, 5, 5, 6], 6)).toEqual({ current: 2, longest: 2 });
  });
  it("is zero with no proofs", () => {
    expect(streaks([], 6)).toEqual({ current: 0, longest: 0 });
  });
});

describe("pointsByWeek", () => {
  it("sums verified tasks per week", () => {
    const byWeek = pointsByWeek([
      { weekStart: 1, slot: "body", status: "verified", points: 30 },
      { weekStart: 1, slot: "mind", status: "verified", points: 20 },
      { weekStart: 1, slot: "chores", status: "held", points: 50 },
      { weekStart: 2, slot: "body", status: "verified", points: 10 },
    ]);
    expect([...byWeek.entries()]).toEqual([
      [1, 50],
      [2, 10],
    ]);
  });
});

describe("fastestResponseSec", () => {
  it("is the quickest gap between a drop opening and its proof", () => {
    expect(
      fastestResponseSec([
        { opensAt: 1_000, provedAt: 91_000 },
        { opensAt: 5_000, provedAt: 47_400 },
      ]),
    ).toBe(42);
  });
  it("is undefined for a player who never answered a drop", () => {
    expect(fastestResponseSec([])).toBeUndefined();
  });
});

describe("profile.get", () => {
  // Thursday of the week that starts at WEEK.
  const NOW = WEEK + 3 * DAY + 12 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives every number from the player's tasks, proofs and drops", async () => {
    const t = convexTest(schema, modules);
    const { maya, viewer } = await t.run(async (ctx) => {
      const maya = await ctx.db.insert("users", { name: "Maya" });
      const viewer = await ctx.db.insert("users", { name: "Sam" });
      const leagueId = await ctx.db.insert("leagues", {
        name: "YC", inviteCode: "YC", stakeUsd: 5, visibility: "private", maxMembers: 8, createdBy: maya,
      });
      const dropId = await ctx.db.insert("drops", {
        leagueId, kind: "quicktime", title: "20 push-ups", slot: "body", points: 40, sealed: false,
        opensAt: WEEK + 2 * DAY, closesAt: WEEK + 2 * DAY + 7_200_000, status: "closed",
      });
      const task = async (
        weekStart: number,
        slot: "body" | "mind" | "chores",
        points: number,
        provedAt: number | null,
        extra: { dropId?: typeof dropId; status?: "held" } = {},
      ) => {
        const taskId = await ctx.db.insert("tasks", {
          userId: maya, weekStart, slot, title: slot, points, proofType: "photo",
          status: extra.status ?? (provedAt === null ? "open" : "verified"),
          source: extra.dropId ? "drop" : "draft", ...(extra.dropId ? { dropId: extra.dropId } : {}),
        });
        if (provedAt !== null) {
          await ctx.db.insert("proofs", {
            taskId, userId: maya, weekStart, mediaType: "photo", pass: true, confidence: 0.9,
            reason: "ok", highlight: 5, caption: "ok", via: "app", createdAt: provedAt,
          });
        }
      };
      // Last week: two days in a row, 70 points.
      await task(WEEK - 7 * DAY, "body", 30, WEEK - 7 * DAY + 1);
      await task(WEEK - 7 * DAY, "body", 40, WEEK - 6 * DAY + 1);
      // This week: Tuesday, Wednesday (a quick-time drop answered in 42 seconds) and Thursday.
      await task(WEEK, "mind", 50, WEEK + DAY + 1);
      await task(WEEK, "body", 40, WEEK + 2 * DAY + 42_000, { dropId });
      await task(WEEK, "body", 20, WEEK + 3 * DAY + 1);
      // Not counted: one still open, and one whose proof is under challenge.
      await task(WEEK, "chores", 25, null);
      await task(WEEK, "chores", 25, WEEK + 3 * DAY + 2, { status: "held" });
      return { maya, viewer };
    });

    const profile = await t
      .withIdentity({ subject: viewer + "|test-session" })
      .query(api.profile.get, { userId: maya });

    expect(profile).toEqual({
      name: "Maya",
      totalPoints: 180,
      tasksCompleted: 5,
      completionRate: 5 / 7,
      bestSlot: "body",
      currentStreak: 3,
      longestStreak: 3,
      bestWeek: 110,
      fastestQuickTimeSec: 42,
    });
  });

  it("returns zeros, not errors, for a player who has not started", async () => {
    const t = convexTest(schema, modules);
    const rookie = await t.run((ctx) => ctx.db.insert("users", {}));
    const profile = await t
      .withIdentity({ subject: rookie + "|test-session" })
      .query(api.profile.get, { userId: rookie });
    expect(profile).toEqual({
      name: "Player", totalPoints: 0, tasksCompleted: 0, completionRate: 0, bestSlot: null,
      currentStreak: 0, longestStreak: 0, bestWeek: 0,
    });
  });
});
