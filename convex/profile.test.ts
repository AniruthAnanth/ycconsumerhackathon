// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

import { bestSlot, completionRate, fastestResponseSec, pointsByWeek } from "./profile";

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

describe("pointsByWeek", () => {
  it("scores each week by the standings' rules: task points, slot bonus and streak bonus", () => {
    const byWeek = pointsByWeek(
      [
        { weekStart: 1, slot: "body", status: "verified", points: 30, source: "draft" },
        { weekStart: 1, slot: "mind", status: "verified", points: 20, source: "draft" },
        { weekStart: 1, slot: "chores", status: "held", points: 50, source: "draft" },
        { weekStart: 2, slot: "body", status: "verified", points: 10, source: "flex" },
      ],
      [
        { weekStart: 1, day: 100 },
        { weekStart: 1, day: 101 },
        { weekStart: 2, day: 107 },
      ],
    );
    // Week 1: 50 task points, two slots cleared (+50), a two-day streak (+5, +10).
    // Week 2: 10 task points, no slot (a flex task clears none), one proof day (+5).
    expect([...byWeek.entries()]).toEqual([
      [1, 115],
      [2, 15],
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
        leagueId, kind: "quicktime", title: "20 push-ups", slot: "body", points: 40,
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
      // Last week: two days in a row. 70 task points, Body cleared (+25), streak (+5, +10).
      await task(WEEK - 7 * DAY, "body", 30, WEEK - 7 * DAY + 1);
      await task(WEEK - 7 * DAY, "body", 40, WEEK - 6 * DAY + 1);
      // This week: Tuesday, Wednesday (a quick-time drop answered in 42 seconds) and Thursday.
      // 110 task points, Mind and Body cleared (+50; the drop clears no slot), streak (+5, +10, +15).
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
      totalPoints: 300,
      tasksCompleted: 5,
      completionRate: 5 / 7,
      bestSlot: "body",
      currentStreak: 3,
      longestStreak: 3,
      bestWeek: 190,
      fastestQuickTimeSec: 42,
      slotRates: [{ slot: "body", rate: 1 }, { slot: "mind", rate: 1 }, { slot: "chores", rate: 0 }],
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
      currentStreak: 0, longestStreak: 0, bestWeek: 0, slotRates: [],
    });
  });
});
