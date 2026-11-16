/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { weekEndOf, weekStartOf } from "./lib/week";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Thursday 12 November 2026, noon Pacific.
const THURSDAY = new Date("2026-11-12T20:00:00Z").getTime();
const WEEK = weekStartOf(THURSDAY);
const HOUR = 60 * 60 * 1000;

type Harness = TestConvex<typeof schema>;
const as = (t: Harness, userId: Id<"users">) => t.withIdentity({ subject: `${userId}|session` });

/** A free two-player league, zz-named so it can never be mistaken for the demo set. */
async function league(t: Harness, stakeUsd = 0) {
  return await t.run(async (ctx) => {
    const ada = await ctx.db.insert("users", { name: "Ada" });
    const bo = await ctx.db.insert("users", { name: "Bo" });
    const leagueId = await ctx.db.insert("leagues", { name: "zz markets", inviteCode: "ZZMKT1", stakeUsd, visibility: "private", maxMembers: 10, createdBy: ada });
    for (const userId of [ada, bo]) await ctx.db.insert("memberships", { leagueId, userId, paid: stakeUsd === 0, joinedAt: WEEK });
    const weekId = await ctx.db.insert("weeks", { leagueId, number: 1, startsAt: WEEK, endsAt: weekEndOf(WEEK), status: "open" });
    await ctx.db.insert("matchups", { weekId, userA: ada, userB: bo });
    return { leagueId, ada, bo };
  });
}

async function task(t: Harness, userId: Id<"users">, slot: "body" | "mind" | "recharge" | "chores" | "people", points: number, provedAt?: number) {
  await t.run(async (ctx) => {
    const taskId = await ctx.db.insert("tasks", {
      userId,
      weekStart: WEEK,
      slot,
      title: `${slot} task`,
      points,
      proofType: "photo",
      status: provedAt === undefined ? "open" : "verified",
      source: "draft",
    });
    if (provedAt === undefined) return;
    await ctx.db.insert("proofs", {
      taskId,
      userId,
      weekStart: WEEK,
      mediaType: "photo",
      pass: true,
      confidence: 0.9,
      reason: "Looks right.",
      highlight: 5,
      caption: "Done.",
      via: "app",
      createdAt: provedAt,
    });
  });
}

describe("markets.week", () => {
  test("opens at even odds and steps once per verified proof", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ada, bo } = await league(t);
    for (const userId of [ada, bo]) {
      await task(t, userId, "body", 30);
      await task(t, userId, "mind", 30);
    }
    const opening = await as(t, ada).query(api.markets.week, { leagueId });
    expect(opening?.matchup?.history).toEqual([{ at: WEEK, chance: 0.5 }]);
    expect(opening?.matchup?.chance).toBe(0.5);

    await task(t, ada, "people", 40, THURSDAY - 30 * HOUR);
    await task(t, ada, "chores", 20, THURSDAY);
    const market = await as(t, ada).query(api.markets.week, { leagueId });
    const matchup = market?.matchup;
    if (!matchup) throw new Error("Ada has no matchup");

    expect(matchup.opponentName).toBe("Bo");
    expect(matchup.history.map((point) => point.at)).toEqual([WEEK, THURSDAY - 30 * HOUR, THURSDAY]);
    // Each proof Ada lands moves her up, and the last is the price the hero shows.
    expect(matchup.history[1].chance).toBeGreaterThan(0.5);
    expect(matchup.history[2].chance).toBeGreaterThan(matchup.history[1].chance);
    expect(matchup.chance).toBe(matchup.history[2].chance);
    expect(matchup.deltaToday).toBe(Math.round(matchup.history[2].chance * 100) - Math.round(matchup.history[1].chance * 100));

    // Banked points are the League tab's: 40 + 20, 25 for each cleared slot, and a two-day streak (5 + 10).
    const table = await as(t, ada).query(api.standings.table, { leagueId });
    expect(market.me.confirmed).toBe(table.find((row) => row.userId === ada)?.points);
    expect(market.me.confirmed).toBe(125);
    expect(market.me.low).toBeGreaterThanOrEqual(125);
    // Two open slots for Ada: 30 points and a 25-point slot bonus each.
    expect(market.me.high).toBeLessThanOrEqual(125 + 2 * 55);
    // A free league has no pot, so its odds are the chance of the week's top score.
    expect(market.odds.kind).toBe("week");
    expect(market.odds.rows.map((row) => row.name)).toEqual(["Ada", "Bo"]);
    expect(market.odds.rows[0].chance + market.odds.rows[1].chance).toBeCloseTo(1, 9);

    // standings.matchup reports the same number, so the hero and the chart agree.
    const standing = await as(t, ada).query(api.standings.matchup, { leagueId });
    expect(standing?.me.winProbability).toBe(matchup.chance);
    expect((standing?.me.winProbability ?? 0) + (standing?.opponent.winProbability ?? 0)).toBeCloseTo(1);
  });

  test("standings.matchup prices at the league's latest proof, even one from outside the pair", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ada, bo } = await league(t);
    const cy = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "Cy" });
      await ctx.db.insert("memberships", { leagueId, userId, paid: true, joinedAt: WEEK });
      return userId;
    });
    await task(t, ada, "body", 40, THURSDAY - 30 * HOUR);
    await task(t, ada, "mind", 30);
    await task(t, bo, "body", 30);
    await task(t, bo, "mind", 30);
    // Cy's proof a day later lets time run down on Ada and Bo's matchup.
    await task(t, cy, "body", 30, THURSDAY);
    const market = await as(t, ada).query(api.markets.week, { leagueId });
    const standing = await as(t, ada).query(api.standings.matchup, { leagueId });
    expect(market?.asOf).toBe(THURSDAY);
    expect(standing?.me.winProbability).toBe(market?.matchup?.chance);
  });

  test("leans on each player's history: a reliable finisher is favoured over a flaky one", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, ada, bo } = await league(t);
    await t.run(async (ctx) => {
      for (const [userId, status] of [[ada, "verified"], [bo, "failed"]] as const) {
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("tasks", { userId, weekStart: WEEK - 7 * 24 * HOUR, slot: "body", title: "old", points: 30, proofType: "photo", status, source: "draft" });
        }
      }
    });
    for (const userId of [ada, bo]) await task(t, userId, "body", 40);
    const market = await as(t, ada).query(api.markets.week, { leagueId });
    expect(market?.matchup?.chance).toBeGreaterThan(0.6);
    expect(market?.me.projected).toBeGreaterThan(market?.matchup?.opponent.projected ?? Infinity);
  });

  test("projects the payout in a staked league and nothing in a free one", async () => {
    const t = convexTest(schema, modules);
    const free = await league(t);
    await task(t, free.ada, "body", 30, THURSDAY);
    const freeMarket = await as(t, free.ada).query(api.markets.week, { leagueId: free.leagueId });
    expect(freeMarket?.payout.eligible).toBe(false);
    expect(freeMarket?.payout.expectedNetUsd).toBe(0);

    const staked = await league(t, 20);
    await t.run(async (ctx) => {
      const week = await ctx.db.query("weeks").withIndex("by_league", (q) => q.eq("leagueId", staked.leagueId)).first();
      for (const userId of [staked.ada, staked.bo]) {
        await ctx.db.insert("ledger", { leagueId: staked.leagueId, weekId: week!._id, userId, kind: "buy_in", amountUsd: 20, idempotencyKey: `buy-in-${userId}`, createdAt: WEEK });
      }
    });
    for (const slot of ["body", "mind", "recharge", "chores", "people"] as const) await task(t, staked.ada, slot, 30, THURSDAY - HOUR);
    await task(t, staked.bo, "body", 30);
    const market = await as(t, staked.ada).query(api.markets.week, { leagueId: staked.leagueId });
    expect(market?.payout.eligible).toBe(true);
    // Ada has swept and Bo can't, so she takes the pot outright and the column still sums to 1.
    expect(market?.payout.potChance).toBe(1);
    expect(market?.odds.kind).toBe("pot");
    expect(market?.odds.rows.map((row) => [row.name, row.chance])).toEqual([["Ada", 1], ["Bo", 0]]);
    expect(market?.odds.nobody).toBe(0);
    const shares = market!.odds.rows.reduce((sum, row) => sum + row.shareUsd, 0);
    expect(shares + market!.odds.nobody * market!.odds.potUsd).toBeCloseTo(market!.odds.potUsd, 6);
    expect(market?.payout.everyoneShareUsd).toBe(market!.odds.potUsd / 2);
    expect(market!.payout.cashOutAt).toBeGreaterThan(market!.asOf);
    // Ada has finished and Bo hasn't started, so she expects to win some of Bo's stake.
    expect(market?.payout.expectedNetUsd).toBeGreaterThan(0);
    expect(market?.payout.lowNetUsd).toBeLessThanOrEqual(market?.payout.expectedNetUsd ?? 0);
    expect(market?.payout.history[market.payout.history.length - 1]?.netUsd).toBe(market?.payout.expectedNetUsd);
  });

  test("is null for someone outside the league", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await league(t);
    const outsider = await t.run((ctx) => ctx.db.insert("users", { name: "Cy" }));
    expect(await as(t, outsider).query(api.markets.week, { leagueId })).toBeNull();
  });
});
