/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import { weekStartOf } from "./lib/week";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Sunday 15 November 2026, 2:30 PM Pacific.
const NOW = new Date("2026-11-15T22:30:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("leaderboard hooks", () => {
  test("joining a league stores the newcomer's week there", async () => {
    const t = convexTest(schema, modules);
    const weekStart = weekStartOf(NOW);
    const ownerId = await t.run((ctx) => ctx.db.insert("users", { name: "Owner" }));
    const { leagueId, inviteCode } = await t
      .withIdentity({ subject: `${ownerId}|session` })
      .mutation(api.leagues.create, { name: "Hooks", stakeUsd: 0, visibility: "private" });
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "Newcomer" });
      const taskId = await ctx.db.insert("tasks", {
        userId,
        weekStart,
        slot: "body",
        title: "Run",
        points: 30,
        proofType: "photo",
        status: "verified",
        source: "draft",
      });
      await ctx.db.insert("proofs", {
        taskId,
        userId,
        weekStart,
        mediaType: "photo",
        pass: true,
        confidence: 0.9,
        reason: "Looks right.",
        highlight: 5,
        caption: "Done.",
        via: "app",
        createdAt: NOW,
      });
      return userId;
    });

    await t.withIdentity({ subject: `${userId}|session` }).mutation(api.leagues.joinByCode, { inviteCode });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const row = await t.run((ctx) =>
      ctx.db
        .query("scores")
        .withIndex("by_league_week_user", (q) => q.eq("leagueId", leagueId).eq("weekStart", weekStart).eq("userId", userId))
        .unique(),
    );
    expect(row?.now.points).toBeGreaterThanOrEqual(30);
    expect(row?.now.tasksVerified).toBe(1);
  });
});
