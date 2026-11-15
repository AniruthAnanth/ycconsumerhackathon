/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { LeagueSettings } from "./lib/schedule";
import schema from "./schema";

// What the Season screen shows when a league's membership, season boundaries
// and scores are not the tidy case: a league that is still filling, ties, a
// league of one, and the first week of a second season. Everything runs
// through the real mutations, so the weeks are stored the way the app stores
// them.

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

async function leagueOf(names: string[], settings?: Partial<LeagueSettings>) {
  const t = convexTest(schema, modules);
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
  const openWeek = async (leagueWeek: number) => {
    vi.setSystemTime(NOW + (leagueWeek - 1) * WEEK_MS);
    await t.mutation(internal.leagues.startWeek, { leagueId });
  };
  return { t, as, userIds, leagueId, inviteCode, overview, openWeek };
}

describe("seasons.overview as the league changes", () => {
  it("shows a tied week as nobody's win or loss", async () => {
    const { overview, openWeek } = await leagueOf(["Ava", "Ben", "Cal", "Dee"]);
    await openWeek(2);

    const season = await overview();
    expect(season.weeks[0].status).toBe("final");
    expect(season.weeks[0].matchups).toHaveLength(2);
    for (const matchup of season.weeks[0].matchups) {
      expect(matchup.scoreA).toBe(matchup.scoreB);
      expect(matchup.winnerId).toBeNull();
    }
    expect(season.table.map((row) => [row.wins, row.losses, row.ties])).toEqual([
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
    ]);
    // Level on everything, the member who joined first ranks first.
    expect(season.table.map((row) => row.name)).toEqual(["Ava", "Ben", "Cal", "Dee"]);
  });

  it("starts season 2 with an empty table and does not carry season 1's results over", async () => {
    const { t, userIds, overview, openWeek } = await leagueOf(
      ["Ava", "Ben", "Cal", "Dee"],
      { seasonWeeks: 2 },
    );
    const [ava, , cal] = userIds;
    const weekStart = (await t.run((ctx) => ctx.db.query("weeks").first()))!.startsAt;
    await t.run(async (ctx) => {
      for (const [userId, points] of [[ava, 40], [cal, 20]] as const) {
        await ctx.db.insert("tasks", {
          userId,
          weekStart,
          slot: "body",
          title: "Gym",
          points,
          proofType: "photo",
          status: "verified",
          source: "draft",
        });
      }
    });

    await openWeek(2);
    const first = await overview();
    expect(first.season).toBe(1);
    expect(first.table.map((row) => [row.name, row.wins])).toEqual([
      ["Ava", 1],
      ["Cal", 1],
      ["Ben", 0],
      ["Dee", 0],
    ]);

    await openWeek(3);
    const second = await overview();
    expect(second.season).toBe(2);
    expect(second.currentWeek).toBe(1);
    expect(second.weeks.map((week) => week.status)).toEqual(["live", "upcoming"]);
    expect(second.table.every((row) => row.wins + row.losses + row.ties === 0)).toBe(true);
  });

  it("makes every week its own season when a season is one week", async () => {
    const { overview, openWeek } = await leagueOf(["Ava", "Ben", "Cal", "Dee"], { seasonWeeks: 1 });
    await openWeek(2);
    await openWeek(3);

    const season = await overview();
    expect(season.season).toBe(3);
    expect(season.currentWeek).toBe(1);
    expect(season.weeks).toHaveLength(1);
    expect(season.weeks[0].status).toBe("live");
    expect(season.weeks[0].matchups).toHaveLength(2);
  });

  it("gives a league of one a bye, and no bracket to play", async () => {
    for (const format of ["round_robin", "bracket"] as const) {
      const { overview } = await leagueOf(["Ava"], { format });
      const season = await overview();
      expect(season.weeks[0].matchups).toEqual([]);
      expect(season.weeks[0].byes.map((player) => player.name)).toEqual(["Ava"]);
      expect(season.bracket).toBeNull();
      expect(season.table.map((row) => row.name)).toEqual(["Ava"]);
    }
  });

  it("lists a mid-week joiner's stand-in as a bye, not as a game", async () => {
    const { t, as, inviteCode, overview } = await leagueOf(["Ava", "Ben", "Cal", "Dee"]);
    const eve = await t.run((ctx) => ctx.db.insert("users", { name: "Eve" }));
    await as(eve).mutation(api.leagues.joinByCode, { inviteCode });

    const season = await overview();
    expect(season.weeks[0].matchups).toHaveLength(2);
    expect(season.weeks[0].byes.map((player) => player.name)).toEqual(["Eve"]);
    expect(season.table.map((row) => row.name)).toEqual(["Ava", "Ben", "Cal", "Dee", "Eve"]);
  });
});
