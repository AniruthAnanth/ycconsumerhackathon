// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { leadChangeText, outrightLeader } from "./leadChange";
import { weekEndOf, weekStartOf } from "./lib/week";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type Backend = TestConvex<typeof schema>;

describe("outrightLeader", () => {
  const maya = { userId: "maya", name: "Maya Chen", points: 240 };
  const sam = { userId: "sam", name: "Sam Patel", points: 225 };

  it("is the top of the table and the gap to second", () => {
    expect(outrightLeader([maya, sam])).toEqual({ leader: maya, runnerUp: sam, gap: 15 });
    expect(outrightLeader([maya])).toEqual({ leader: maya, runnerUp: null, gap: 240 });
  });

  it("is nobody while the top two are level or nobody has scored", () => {
    expect(outrightLeader([maya, { ...sam, points: 240 }])).toBeNull();
    expect(outrightLeader([{ ...maya, points: 0 }, { ...sam, points: 0 }])).toBeNull();
    expect(outrightLeader([])).toBeNull();
  });
});

describe("leadChangeText", () => {
  it("names the new leader, their points and the margin, by first name", () => {
    expect(
      leadChangeText({
        leagueName: "YC Hackathon",
        leader: { name: "Maya Chen", points: 240 },
        runnerUp: { name: "Sam Patel" },
        gap: 15,
      }),
    ).toBe("Maya took the lead in YC Hackathon: 240 points, 15 ahead of Sam.");
    expect(
      leadChangeText({ leagueName: "Solo", leader: { name: "Maya", points: 40 }, runnerUp: null, gap: 40 }),
    ).toBe("Maya took the lead in Solo: 40 points.");
  });
});

describe("afterProof", () => {
  const NOW = Date.UTC(2026, 10, 15, 20);
  let texts: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    // Keiki is not configured here, and keiki.send then logs the text it would have sent.
    vi.stubEnv("KEIKI_AGENT_ID", "");
    texts = [];
    vi.spyOn(console, "warn").mockImplementation((message: unknown) => void texts.push(String(message)));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function startLeague(t: Backend) {
    return await t.run(async (ctx) => {
      const maya = await ctx.db.insert("users", { name: "Maya Chen" });
      const sam = await ctx.db.insert("users", { name: "Sam Patel" });
      const leagueId = await ctx.db.insert("leagues", {
        name: "YC Hackathon",
        inviteCode: "YCHACK",
        stakeUsd: 5,
        visibility: "private",
        maxMembers: 12,
        createdBy: maya,
      });
      for (const userId of [maya, sam]) {
        await ctx.db.insert("memberships", { leagueId, userId, paid: true, joinedAt: NOW });
      }
      const startsAt = weekStartOf(NOW);
      await ctx.db.insert("weeks", { leagueId, number: 1, startsAt, endsAt: weekEndOf(startsAt), status: "open" });
      return { leagueId, maya, sam };
    });
  }

  /** A flex task verified now: it scores its points and nothing else. */
  async function score(t: Backend, userId: Id<"users">, points: number) {
    await t.run(async (ctx) => {
      await ctx.db.insert("tasks", {
        userId,
        weekStart: weekStartOf(NOW),
        slot: "flex",
        title: "Extra mile",
        points,
        proofType: "photo",
        status: "verified",
        source: "flex",
      });
    });
    await t.mutation(internal.leadChange.afterProof, { userId });
    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();
  }

  const leaderOf = (t: Backend, leagueId: Id<"leagues">) =>
    t.run(async (ctx) => (await ctx.db.get("leagues", leagueId))?.leaderId);

  it("records the first leader quietly, then texts the league when the lead changes hands", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, maya, sam } = await startLeague(t);

    await score(t, sam, 30);
    expect(await leaderOf(t, leagueId)).toBe(sam);
    expect(texts).toEqual([]);

    await score(t, maya, 45);
    expect(await leaderOf(t, leagueId)).toBe(maya);
    expect(texts.join("\n")).toContain("Maya took the lead in YC Hackathon: 45 points, 15 ahead of Sam.");
  });

  it("says nothing while the leader stays in front, or when the top two are level", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, maya, sam } = await startLeague(t);
    await score(t, sam, 30);

    await score(t, sam, 10);
    await score(t, maya, 40);
    // Run again for the same proof, as happens when a drop bonus is priced afterwards.
    await t.mutation(internal.leadChange.afterProof, { userId: maya });

    expect(await leaderOf(t, leagueId)).toBe(sam);
    expect(texts).toEqual([]);
  });
});
