/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { scheduleFor, type LeagueSettings } from "./lib/schedule";
import schema from "./schema";

// The two places leagues.ts meets the formats: leagues.create stores the
// settings, and opening a week asks the format for its pairings. These run
// both against a real (in-memory) database, with seasons.overview reading
// the result back.

const modules = import.meta.glob("./**/*.ts");

// Wednesday 18 November 2026, noon Pacific.
const NOW = Date.UTC(2026, 10, 18, 20, 0, 0);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

function newHarness() {
  return convexTest(schema, modules);
}

/** A league whose first named player created it and the rest joined by code, in order. */
async function leagueOf(names: string[], settings?: Partial<LeagueSettings>) {
  const t = newHarness();
  const userIds: Id<"users">[] = [];
  for (const name of names) {
    userIds.push(await t.run((ctx) => ctx.db.insert("users", { name })));
  }
  const as = (userId: Id<"users">) => t.withIdentity({ subject: userId + "|session" });
  const { leagueId, inviteCode } = await as(userIds[0]).mutation(api.leagues.create, {
    name: "Test League",
    stakeUsd: 0,
    visibility: "private",
    ...(settings ? { settings } : {}),
  });
  for (const userId of userIds.slice(1)) {
    await as(userId).mutation(api.leagues.joinByCode, { inviteCode });
  }
  const overview = () => as(userIds[0]).query(api.seasons.overview, { leagueId });
  return { t, userIds, leagueId, overview };
}

/** The newest week's stored matchups as [userA, userB] pairs. */
async function storedPairs(t: ReturnType<typeof newHarness>, leagueId: Id<"leagues">) {
  return await t.run(async (ctx) => {
    const week = await ctx.db
      .query("weeks")
      .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
      .order("desc")
      .first();
    const rows = await ctx.db
      .query("matchups")
      .withIndex("by_week", (q) => q.eq("weekId", week!._id))
      .collect();
    return rows.map((row) => [row.userA, row.userB]);
  });
}

describe("leagues.create with settings", () => {
  it("keeps weekly, 8 weeks and round robin for a league created without any", async () => {
    const { t, leagueId, overview } = await leagueOf(["Ava", "Ben"]);
    const season = await overview();
    expect(season.settings).toEqual({ payout: "weekly", seasonWeeks: 8, format: "round_robin" });
    expect(season.weeks).toHaveLength(8);
    expect(season.bracket).toBeNull();
    // Nothing is written for a default, so the row is what it was before settings existed.
    const row = await t.run((ctx) => ctx.db.get("leagues", leagueId));
    expect(row).not.toHaveProperty("format");
  });

  it("stores what the creator chose", async () => {
    const chosen = { payout: "season", seasonWeeks: 4, format: "bracket" } as const;
    const { overview } = await leagueOf(["Ava", "Ben"], chosen);
    const season = await overview();
    expect(season.settings).toEqual(chosen);
    expect(season.weeks).toHaveLength(4);
    expect(season.bracket?.rounds.map((round) => round.name)).toEqual(["Final"]);
  });

  it("turns down a season that is not 1 to 52 whole weeks", async () => {
    await expect(leagueOf(["Ava"], { seasonWeeks: 0 })).rejects.toThrow("A season is 1 to 52 weeks");
    await expect(leagueOf(["Ava"], { seasonWeeks: 2.5 })).rejects.toThrow("A season is 1 to 52 weeks");
  });
});

describe("opening a week", () => {
  it("pairs the next week by the league's format, in join order", async () => {
    const { t, userIds, leagueId } = await leagueOf(["Ava", "Ben", "Cal", "Dee"], {
      format: "double_round_robin",
    });
    vi.setSystemTime(NOW + WEEK_MS);
    await t.mutation(internal.leagues.startWeek, { leagueId });

    const expected = scheduleFor("double_round_robin", userIds, 2, []);
    expect(await storedPairs(t, leagueId)).toEqual(expected.map(({ a, b }) => [a, b]));
  });

  it("shows a bye in the season, not the stand-in an odd league stores", async () => {
    const { t, userIds, leagueId, overview } = await leagueOf(["Ava", "Ben", "Cal"]);
    vi.setSystemTime(NOW + WEEK_MS);
    await t.mutation(internal.leagues.startWeek, { leagueId });

    // Stored: the real pair, then the member with the week off against its first player.
    const stored = await storedPairs(t, leagueId);
    expect(stored).toHaveLength(2);
    expect(stored[1][1]).toBe(stored[0][0]);

    const season = await overview();
    const live = season.weeks[1];
    expect(live.status).toBe("live");
    expect(live.matchups).toHaveLength(1);
    expect(live.byes.map((player) => player.userId)).toEqual([stored[1][0]]);
    expect(season.table.map((row) => row.userId).sort()).toEqual([...userIds].sort());
  });

  it("seeds the bracket from the regular season's results", async () => {
    // Three weeks: one of round robin, then semifinals and the final.
    const { t, userIds, leagueId, overview } = await leagueOf(["Ava", "Ben", "Cal", "Dee"], {
      format: "bracket",
      seasonWeeks: 3,
    });
    const [ava, ben, cal, dee] = userIds;
    // Week 1 is Ava v Ben and Cal v Dee. Ava and Cal win; Ben outscores Dee.
    const weekStart = (await t.run((ctx) => ctx.db.query("weeks").first()))!.startsAt;
    const points = new Map([[ava, 40], [ben, 30], [cal, 20], [dee, 10]]);
    await t.run(async (ctx) => {
      for (const [userId, earned] of points) {
        await ctx.db.insert("tasks", {
          userId,
          weekStart,
          slot: "body",
          title: "Gym",
          points: earned,
          proofType: "photo",
          status: "verified",
          source: "draft",
        });
      }
    });

    vi.setSystemTime(NOW + WEEK_MS);
    await t.mutation(internal.leagues.startWeek, { leagueId });

    // Seeds: Ava, Cal (the winners, by points), then Ben, Dee. So 1 v 4 and 2 v 3.
    expect(await storedPairs(t, leagueId)).toEqual([
      [ava, dee],
      [cal, ben],
    ]);
    const season = await overview();
    expect(season.currentWeek).toBe(2);
    expect(season.weeks[1].round).toBe("Semifinals");
    expect(season.bracket?.projected).toBe(false);
    expect(season.bracket?.rounds[0].matches.map((match) => [match.a?.seed, match.b?.seed])).toEqual([
      [1, 4],
      [2, 3],
    ]);
    expect(season.table.map((row) => [row.name, row.wins, row.losses])).toEqual([
      ["Ava", 1, 0],
      ["Cal", 1, 0],
      ["Ben", 0, 1],
      ["Dee", 0, 1],
    ]);
  });
});
