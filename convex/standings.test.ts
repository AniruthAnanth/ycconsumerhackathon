/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { weekEndOf, weekStartOf } from "./lib/week";
import schema from "./schema";
import { pointsInLeague } from "./standings";

const modules = import.meta.glob("./**/*.ts");

// Sunday 15 November 2026, 2:30 PM Pacific: the last afternoon of the seeded week.
const NOW = new Date("2026-11-15T22:30:00Z").getTime();
const WEEK = weekStartOf(NOW);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

type Harness = TestConvex<typeof schema>;

/** The seeded league, with its ids and each seeded player's id by first name. */
async function seeded(t: Harness) {
  await t.mutation(api.seed.reset, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return await t.run(async (ctx) => {
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", "YCHACK"))
      .unique();
    if (league === null) throw new Error("The seeded league is missing");
    // The week in play is the newest row; the seed also keeps the season's finished weeks.
    const week = await ctx.db
      .query("weeks")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .order("desc")
      .first();
    if (week === null) throw new Error("The seeded week is missing");
    const ids: Record<string, Id<"users">> = {};
    for (const user of await ctx.db.query("users").collect()) {
      ids[(user.name ?? "").split(" ")[0]] = user._id;
    }
    return { leagueId: league._id, weekId: week._id, ids };
  });
}

const as = (t: Harness, userId: Id<"users">) => t.withIdentity({ subject: `${userId}|session` });

/** Gives a player a verified task with a passing proof right now, as proofs.verify would. */
async function verifyNewTask(t: Harness, userId: Id<"users">, points: number, dropId?: Id<"drops">) {
  await t.run(async (ctx) => {
    const taskId = await ctx.db.insert("tasks", {
      userId,
      weekStart: WEEK,
      slot: "body",
      title: "Swim 20 lengths",
      points,
      proofType: "photo",
      status: "verified",
      source: dropId ? "drop" : "draft",
      ...(dropId && { dropId }),
    });
    await ctx.db.insert("proofs", {
      taskId,
      userId,
      weekStart: WEEK,
      mediaType: "photo",
      pass: true,
      confidence: 0.9,
      reason: "A pool lane and a swim cap.",
      highlight: 5,
      caption: "Twenty lengths.",
      via: "app",
      createdAt: NOW - 60_000,
    });
  });
}

describe("standings.table", () => {
  test("ranks the seeded league from its tasks and proofs", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ids } = await seeded(t);

    const table = await as(t, ids.Maya).query(api.standings.table, { leagueId });

    expect(table.map(({ rank, name, points, slotsCleared, streak }) => [rank, name, points, slotsCleared, streak])).toEqual([
      [1, "Maya Chen", 500, 5, 6],
      [2, "Sam Patel", 285, 4, 2],
      [3, "Priya Shah", 195, 3, 2],
      [4, "Jordan Lee", 120, 2, 1],
      // Ava's last proof was two days before the league's latest, so her streak is over.
      [5, "Ava Kim", 60, 1, 0],
      [6, "Leo Martinez", 0, 0, 0],
    ]);
    expect(table.every((row) => row.paid)).toBe(true);
  });

  test("is empty for a signed-in player outside the league, and for a league that is gone", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ids } = await seeded(t);
    const outsiderId = await t.run((ctx) => ctx.db.insert("users", { name: "Nova", phone: "+14155550177" }));

    expect(await as(t, outsiderId).query(api.standings.table, { leagueId })).toEqual([]);
    expect(await as(t, ids.Maya).query(api.standings.table, { leagueId })).toHaveLength(6);

    await t.run(async (ctx) => {
      for (const week of await ctx.db.query("weeks").collect()) await ctx.db.delete("weeks", week._id);
      for (const membership of await ctx.db.query("memberships").collect()) await ctx.db.delete("memberships", membership._id);
      await ctx.db.delete("leagues", leagueId);
    });
    expect(await as(t, outsiderId).query(api.standings.table, { leagueId })).toEqual([]);
  });

  test("reorders the moment a proof is written", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await seeded(t);
    const novaId = await t.run((ctx) => ctx.db.insert("users", { name: "Nova", phone: "+14155550177" }));
    const nova = as(t, novaId);
    await nova.mutation(api.leagues.joinByCode, { inviteCode: "ychack" });

    const before = await nova.query(api.standings.table, { leagueId });
    expect(before.find((row) => row.userId === novaId)).toMatchObject({ points: 0, paid: false });

    await verifyNewTask(t, novaId, 40);

    // 40 for the task, 25 for the slot and 5 for the first day of a streak.
    const after = await nova.query(api.standings.table, { leagueId });
    expect(after.map((row) => row.name).slice(3)).toEqual(["Jordan Lee", "Nova", "Ava Kim", "Leo Martinez"]);
    expect(after.find((row) => row.userId === novaId)).toMatchObject({ rank: 5, points: 70, slotsCleared: 1, streak: 1 });
  });

  test("a drop task counts only in its drop's league", async () => {
    const t = convexTest(schema, modules);
    const { ids } = await seeded(t);
    const sam = as(t, ids.Sam);
    const { leagueId: otherLeagueId } = await sam.mutation(api.leagues.create, {
      name: "Side league",
      stakeUsd: 0,
      visibility: "private",
    });

    // Sam's 285 in the seeded league includes 50 from its quick-time drop.
    const table = await sam.query(api.standings.table, { leagueId: otherLeagueId });
    expect(table).toHaveLength(1);
    expect(table[0]).toMatchObject({ name: "Sam Patel", points: 235, slotsCleared: 4, paid: true });
  });

  test("a held task counts for nothing: no points, no slot, no streak day", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ids } = await seeded(t);
    await t.run(async (ctx) => {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_user_week", (q) => q.eq("userId", ids.Maya).eq("weekStart", WEEK))
        .collect();
      const legDay = tasks.find((task) => task.title === "Leg day at the gym");
      if (!legDay) throw new Error("Maya's leg day task is missing");
      await ctx.db.patch("tasks", legDay._id, { status: "held" });
    });

    const table = await as(t, ids.Maya).query(api.standings.table, { leagueId });

    // Minus the task's 40, its slot's 25, the sweep's 100, and the streak restarts on Tuesday (75, not 100).
    expect(table[0]).toMatchObject({ name: "Maya Chen", points: 310, slotsCleared: 4, streak: 5 });
  });

  test("adds the challenger's points from challenges decided this week", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ids } = await seeded(t);
    await t.run(async (ctx) => {
      const proof = await ctx.db
        .query("proofs")
        .withIndex("by_user_week", (q) => q.eq("userId", ids.Jordan).eq("weekStart", WEEK))
        .first();
      if (!proof) throw new Error("Jordan has no proof");
      await ctx.db.insert("challenges", {
        proofId: proof._id,
        leagueId,
        challengerId: ids.Leo,
        status: "overturned",
        closesAt: NOW - 60_000,
      });
    });

    const table = await as(t, ids.Leo).query(api.standings.table, { leagueId });
    expect(table.find((row) => row.userId === ids.Leo)?.points).toBe(10);
  });

  test("a settled week pays +50 to the winner of each head-to-head", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, weekId, ids } = await seeded(t);

    // Maya v Sam, Priya v Ava, Jordan v Leo.
    const finalPoints = [
      ["Maya Chen", 550],
      ["Sam Patel", 285],
      ["Priya Shah", 245],
      ["Jordan Lee", 170],
      ["Ava Kim", 60],
      ["Leo Martinez", 0],
    ];
    const preview = await t.query(internal.standings.tableForLeague, { leagueId, atSettlement: true });
    expect(preview.map((row) => [row.name, row.points])).toEqual(finalPoints);

    await t.run((ctx) => ctx.db.patch("weeks", weekId, { status: "settled" }));
    const table = await as(t, ids.Maya).query(api.standings.table, { leagueId });
    expect(table.map((row) => [row.name, row.points])).toEqual(finalPoints);
  });
});

describe("the matchup bonus in a league with an odd number of members", () => {
  test("the stand-in pair of a member with the week off pays nobody", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ids } = await seeded(t);
    const novaId = await t.run((ctx) => ctx.db.insert("users", { name: "Nova", phone: "+14155550177" }));
    await as(t, novaId).mutation(api.leagues.joinByCode, { inviteCode: "YCHACK" });

    // Nova's stand-in row is against Maya, who already plays Sam: Maya wins +50 once, not twice.
    const table = await t.query(internal.standings.tableForLeague, { leagueId, atSettlement: true });
    expect(table.find((row) => row.userId === ids.Maya)?.points).toBe(550);
    expect(table.find((row) => row.userId === novaId)?.points).toBe(0);
  });
});

describe("standings.tableForLeague and pointsInLeague", () => {
  test("serve callers with no signed-in player", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ids } = await seeded(t);

    const table = await t.query(internal.standings.tableForLeague, { leagueId, weekStart: WEEK });
    expect(table[0]).toMatchObject({ rank: 1, name: "Maya Chen", points: 500 });
    expect(await t.run((ctx) => pointsInLeague(ctx, leagueId, ids.Sam))).toBe(285);

    await expect(t.query(api.standings.table, { leagueId })).rejects.toThrow(/Not signed in/);
    // Next week: the seeded league has weeks behind it, but none ahead.
    await expect(
      t.query(internal.standings.tableForLeague, { leagueId, weekStart: WEEK + 7 * 24 * 60 * 60 * 1000 }),
    ).rejects.toThrow(/no week starting then/);
  });
});

describe("standings.matchup", () => {
  test("puts the caller against this week's opponent, slot by slot", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ids } = await seeded(t);

    const matchup = await as(t, ids.Sam).query(api.standings.matchup, { leagueId });
    if (matchup === null) throw new Error("Sam has no matchup");

    // Sam projects to 285 + half of the 20 still open, against Maya's finished 500.
    expect(matchup.me).toEqual({ userId: ids.Sam, name: "Sam Patel", total: 285, winProbability: 0.37 });
    expect(matchup.opponent).toEqual({ userId: ids.Maya, name: "Maya Chen", total: 500, winProbability: 0.63 });

    expect(matchup.rows.map((row) => [row.slot, row.mine?.title, row.theirs?.title])).toEqual([
      ["body", "Bike to work", "Leg day at the gym"],
      ["mind", "Ship the onboarding PR", "Finish the CS 161 problem set"],
      ["recharge", "Journal for ten minutes", "Read for 30 minutes"],
      ["chores", "Clean my room", "Do the laundry"],
      ["people", "Call mom", "Dinner with friends"],
      ["flex", "20 push-ups", "Sunset walk"],
    ]);
    expect(matchup.rows[4].mine?.score).toBeNull();
    expect(matchup.rows[5].mine?.score).toBe(50);
  });

  test("is null for a player with no opponent, and a seventh member gets one", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ids } = await seeded(t);
    const novaId = await t.run((ctx) => ctx.db.insert("users", { name: "Nova", phone: "+14155550177" }));
    const nova = as(t, novaId);

    expect(await nova.query(api.standings.matchup, { leagueId })).toBeNull();

    await nova.mutation(api.leagues.joinByCode, { inviteCode: "YCHACK" });
    const joined = await nova.query(api.standings.matchup, { leagueId });
    expect(joined?.me).toMatchObject({ name: "Nova", total: 0 });
    expect(joined?.opponent.name).toBe("Maya Chen");

    // Maya's own matchup is still Sam: the extra pair doesn't replace it.
    const mayas = await as(t, ids.Maya).query(api.standings.matchup, { leagueId });
    expect(mayas?.opponent.name).toBe("Sam Patel");
  });
});

describe("standings.pot", () => {
  test("adds up the week's buy-ins and lists who has paid", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ids } = await seeded(t);
    const novaId = await t.run((ctx) => ctx.db.insert("users", { name: "Nova", phone: "+14155550177" }));
    await as(t, novaId).mutation(api.leagues.joinByCode, { inviteCode: "YCHACK" });

    const pot = await as(t, ids.Maya).query(api.standings.pot, { leagueId });

    expect(pot).toMatchObject({ stakeUsd: 20, potUsd: 120, settlesAt: weekEndOf(WEEK) });
    expect(pot.paid).toHaveLength(6);
    expect(pot.unpaid).toEqual([{ userId: novaId, name: "Nova" }]);
    expect(pot.payouts).toBeUndefined();
  });

  test("is empty for a signed-in player outside the league, and unchanged for a member", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ids } = await seeded(t);
    const outsiderId = await t.run((ctx) => ctx.db.insert("users", { name: "Nova", phone: "+14155550177" }));

    const outsiders = await as(t, outsiderId).query(api.standings.pot, { leagueId });
    expect(outsiders).toEqual({ stakeUsd: 20, potUsd: 0, paid: [], unpaid: [], settlesAt: weekEndOf(WEEK) });

    const members = await as(t, ids.Maya).query(api.standings.pot, { leagueId });
    expect(members).toMatchObject({ stakeUsd: 20, potUsd: 120, settlesAt: weekEndOf(WEEK) });
    expect(members.paid).toHaveLength(6);
  });

  test("still rejects a league that does not exist", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ids } = await seeded(t);
    await t.run(async (ctx) => {
      await ctx.db.delete("leagues", leagueId);
    });
    await expect(as(t, ids.Maya).query(api.standings.pot, { leagueId })).rejects.toThrow(/League not found/);
  });

  test("ticks up when a payment's ledger row is written", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, weekId, ids } = await seeded(t);
    const novaId = await t.run((ctx) => ctx.db.insert("users", { name: "Nova", phone: "+14155550177" }));
    await as(t, novaId).mutation(api.leagues.joinByCode, { inviteCode: "YCHACK" });

    // What the Whop webhook writes for a verified payment.
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", novaId))
        .unique();
      if (!membership) throw new Error("Nova is not a member");
      await ctx.db.patch("memberships", membership._id, { paid: true });
      await ctx.db.insert("ledger", {
        leagueId,
        weekId,
        userId: novaId,
        kind: "buy_in",
        amountUsd: 20,
        idempotencyKey: "buy_in:pay_test",
        createdAt: NOW,
      });
    });

    const pot = await as(t, ids.Maya).query(api.standings.pot, { leagueId });
    expect(pot.potUsd).toBe(140);
    expect(pot.unpaid).toEqual([]);
  });

  test("goes by the ledger, not by the membership's paid flag", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ids } = await seeded(t);
    const novaId = await t.run((ctx) => ctx.db.insert("users", { name: "Nova", phone: "+14155550177" }));
    await as(t, novaId).mutation(api.leagues.joinByCode, { inviteCode: "YCHACK" });
    // A flag with no buy-in behind it, as one left over from an earlier week would be.
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", novaId))
        .unique();
      if (!membership) throw new Error("Nova is not a member");
      await ctx.db.patch("memberships", membership._id, { paid: true });
    });

    const pot = await as(t, ids.Maya).query(api.standings.pot, { leagueId });
    expect(pot.potUsd).toBe(120);
    expect(pot.unpaid).toEqual([{ userId: novaId, name: "Nova" }]);

    const table = await as(t, ids.Maya).query(api.standings.table, { leagueId });
    expect(table.find((row) => row.userId === novaId)?.paid).toBe(false);
    expect(table.filter((row) => row.paid)).toHaveLength(6);
  });

  test("shows the settled week's refunds and winnings, but not the fee", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, weekId, ids } = await seeded(t);
    await t.run(async (ctx) => {
      const row = { leagueId, weekId, createdAt: NOW };
      await ctx.db.insert("ledger", { ...row, userId: ids.Maya, kind: "refund", amountUsd: 20, idempotencyKey: "r" });
      await ctx.db.insert("ledger", { ...row, userId: ids.Maya, kind: "winnings", amountUsd: 90, idempotencyKey: "w" });
      await ctx.db.insert("ledger", { ...row, kind: "fee", amountUsd: 10, idempotencyKey: "f" });
      await ctx.db.patch("weeks", weekId, { status: "settled" });
    });

    const pot = await as(t, ids.Sam).query(api.standings.pot, { leagueId });

    expect(pot.potUsd).toBe(120);
    expect(pot.payouts).toEqual([
      { userId: ids.Maya, name: "Maya Chen", kind: "winnings", amountUsd: 90 },
      { userId: ids.Maya, name: "Maya Chen", kind: "refund", amountUsd: 20 },
    ]);
  });
});
