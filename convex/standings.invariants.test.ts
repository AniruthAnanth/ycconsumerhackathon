/// <reference types="vite/client" />
/**
 * One set of numbers everywhere: for every member of every kind of league, the League table, the
 * Roster and Matchup totals, the season's points for and the This Week board must agree, ranks
 * must follow the live week (points, then slots cleared, then streak) and share a place only when
 * all three are level, and "X of 5 slots" must be the player's verified slot tasks.
 */
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { CORE_SLOTS, type Slot } from "./lib/scoring";
import { weekStartOf } from "./lib/week";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Sunday 15 November 2026, 2:30 PM Pacific.
const NOW = new Date("2026-11-15T22:30:00Z").getTime();
const WEEK = weekStartOf(NOW);
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

type Harness = TestConvex<typeof schema>;
const as = (t: Harness, userId: Id<"users">) => t.withIdentity({ subject: `${userId}|session` });

async function addUser(t: Harness, name: string) {
  return await t.run((ctx) => ctx.db.insert("users", { name }));
}

/** A verified task with a passing proof `daysAgo` days before now. */
async function verified(t: Harness, userId: Id<"users">, slot: Slot, points: number, daysAgo: number, source: "draft" | "flex" = "draft") {
  await t.run(async (ctx) => {
    const taskId = await ctx.db.insert("tasks", {
      userId,
      weekStart: WEEK,
      slot,
      title: `${slot} task`,
      points,
      proofType: "photo",
      status: "verified",
      source,
    });
    await ctx.db.insert("proofs", {
      taskId,
      userId,
      weekStart: WEEK,
      mediaType: "photo",
      pass: true,
      confidence: 0.9,
      reason: "Shows it.",
      highlight: 5,
      caption: "Done.",
      via: "app",
      createdAt: Math.max(WEEK + 60_000, NOW - daysAgo * DAY),
    });
  });
}

async function openTask(t: Harness, userId: Id<"users">, slot: Slot) {
  await t.run((ctx) =>
    ctx.db.insert("tasks", { userId, weekStart: WEEK, slot, title: `${slot} task`, points: 20, proofType: "photo", status: "open", source: "draft" }),
  );
}

/** The slots a player has verified with a drafted task this week, flex excluded. */
async function verifiedSlots(t: Harness, userId: Id<"users">): Promise<number> {
  const tasks = await t.run((ctx) =>
    ctx.db.query("tasks").withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", WEEK)).collect(),
  );
  const slots = new Set(tasks.filter((task) => task.status === "verified" && task.source === "draft").map((task) => task.slot));
  return CORE_SLOTS.filter((slot) => slots.has(slot)).length;
}

/** Every invariant, checked from each member's own phone. */
async function expectConsistent(t: Harness, leagueId: Id<"leagues">) {
  const members = await t.run((ctx) =>
    ctx.db.query("memberships").withIndex("by_league", (q) => q.eq("leagueId", leagueId)).collect(),
  );
  const viewer = as(t, members[0].userId);
  const table = await viewer.query(api.standings.table, { leagueId });
  expect(table).toHaveLength(members.length);

  // Live order, and a shared place only for a true tie.
  for (const [index, row] of table.entries()) {
    const previous = table[index - 1];
    if (previous === undefined) {
      expect(row.rank).toBe(1);
      continue;
    }
    const key = (r: typeof row) => [r.points, r.slotsCleared, r.streak];
    const [p, s, k] = key(previous);
    const [q, u, l] = key(row);
    expect(p > q || (p === q && (s > u || (s === u && k >= l))), `${previous.name} before ${row.name}`).toBe(true);
    const level = p === q && s === u && k === l;
    expect(row.rank).toBe(level ? previous.rank : index + 1);
  }

  const season = await viewer.query(api.seasons.overview, { leagueId });
  const finals = new Map<string, number>();
  for (const week of season.weeks) {
    if (week.status !== "final" || week.round !== undefined) continue;
    for (const { a, b, scoreA, scoreB } of week.matchups) {
      finals.set(a.userId, (finals.get(a.userId) ?? 0) + (scoreA ?? 0));
      finals.set(b.userId, (finals.get(b.userId) ?? 0) + (scoreB ?? 0));
    }
  }
  const pointsFor = new Map(season.table.map((row) => [row.userId, row.pointsFor]));
  const board = await viewer.query(api.leaderboards.board, { leagueId, board: "week" });
  const boardRow = new Map(board.rows.map((row) => [row.userId, row]));

  for (const row of table) {
    // "X of 5 slots" is the verified slot tasks.
    expect(row.slotsCleared, row.name).toBe(await verifiedSlots(t, row.userId));
    // The Roster total is the table's points.
    const roster = await viewer.query(api.lineup.roster, { leagueId, userId: row.userId });
    expect(roster.total, row.name).toBe(row.points);
    // PF is the finished weeks plus the week in play.
    expect(pointsFor.get(row.userId), row.name).toBe((finals.get(row.userId) ?? 0) + row.points);
    // This Week reads the same number and the same place.
    expect(boardRow.get(row.userId)?.value, row.name).toBe(row.points);
    expect(boardRow.get(row.userId)?.rank, row.name).toBe(row.rank);
    // Matchup totals, on both sides, are the table's.
    const matchup = await as(t, row.userId).query(api.standings.matchup, { leagueId });
    if (matchup === null) continue;
    expect(matchup.me.total, row.name).toBe(row.points);
    expect(matchup.opponent.total, matchup.opponent.name).toBe(table.find((other) => other.userId === matchup.opponent.userId)?.points);
    const myScores = matchup.rows.reduce((sum, pair) => sum + (pair.mine?.score ?? 0), 0);
    expect(myScores, row.name).toBeLessThanOrEqual(matchup.me.total);
  }
  return table;
}

describe("standings invariants", () => {
  test("a Quick Match table of ten, free and $5", async () => {
    const t = convexTest(schema, modules);
    for (const stakeUsd of [0, 5] as const) {
      const me = await addUser(t, `Player ${stakeUsd}`);
      const { leagueId } = await as(t, me).mutation(api.leagues.quickMatch, { stakeUsd });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const table = await expectConsistent(t, leagueId);
      // The seeded players stand 5, 4, 4, 3, 3, 2, 2, 1, 0 of 5, best first, and nobody is level with
      // the leader.
      expect(table[0]).toMatchObject({ name: "Nina Okafor", rank: 1, slotsCleared: 5 });
      expect(table.filter((row) => row.rank === 1)).toHaveLength(1);
      expect(table.map((row) => row.slotsCleared).sort((a, b) => b - a)).toEqual([5, 4, 4, 3, 3, 2, 2, 1, 0, 0]);
    }
  });

  test("the seeded demo league in week 5", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.seed.reset, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const league = await t.run((ctx) => ctx.db.query("leagues").withIndex("by_inviteCode", (q) => q.eq("inviteCode", "YCHACK")).unique());
    await expectConsistent(t, league!._id);
  });

  for (const stakeUsd of [0, 5]) {
    test(`a new league of two real players, ${stakeUsd === 0 ? "free" : "$5"}`, async () => {
      const t = convexTest(schema, modules);
      const ana = await addUser(t, "Ana");
      const ben = await addUser(t, "Ben");
      const { leagueId, inviteCode } = await as(t, ana).mutation(api.leagues.create, { name: "Two of us", stakeUsd, visibility: "private" });
      await as(t, ben).mutation(api.leagues.joinByCode, { inviteCode });

      // Level at the start: both share first.
      let table = await expectConsistent(t, leagueId);
      expect(table.map((row) => row.rank)).toEqual([1, 1]);

      // Ana clears two slots on consecutive days; Ben verifies one slot and a flex task, which
      // scores but clears nothing.
      await verified(t, ana, "body", 30, 1);
      await verified(t, ana, "mind", 20, 0);
      await openTask(t, ana, "people");
      await verified(t, ben, "chores", 20, 2);
      await verified(t, ben, "flex", 40, 2, "flex");
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      table = await expectConsistent(t, leagueId);
      expect(table.map((row) => [row.name, row.rank, row.slotsCleared])).toEqual([
        ["Ana", 1, 2],
        ["Ben", 2, 1],
      ]);
    });
  }
});
