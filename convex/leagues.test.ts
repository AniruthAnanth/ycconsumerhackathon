/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import {
  anyApi,
  type ApiFromModules,
  type FilterApi,
  type FunctionReference,
} from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "./_generated/dataModel";
import type * as leaguesModule from "./leagues";
import schema from "./schema";
import type * as usersModule from "./users";

// Typed from the module sources, so these tests compile before and after
// "convex dev" regenerates _generated/api to list the new modules.
type Modules = ApiFromModules<{ leagues: typeof leaguesModule; users: typeof usersModule }>;
const api = anyApi as unknown as FilterApi<Modules, FunctionReference<any, "public">>;

const internal = anyApi as unknown as FilterApi<Modules, FunctionReference<any, "internal">>;

const modules = import.meta.glob("./**/*.ts");

// Wednesday 18 November 2026, noon Pacific. Its week starts Monday 16 November 00:00 PST.
const NOW = Date.UTC(2026, 10, 18, 20, 0, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

type Harness = ReturnType<typeof newHarness>;

function newHarness() {
  return convexTest(schema, modules);
}

async function addUser(
  t: Harness,
  fields: { name?: string; phone?: string; demoActAs?: Id<"users"> } = {},
) {
  return await t.run((ctx) => ctx.db.insert("users", fields));
}

function asUser(t: Harness, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function matchupsOf(t: Harness, leagueId: Id<"leagues">) {
  return await t.run(async (ctx) => {
    const week = await ctx.db
      .query("weeks")
      .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
      .order("desc")
      .first();
    if (week === null) return [];
    const rows = await ctx.db
      .query("matchups")
      .withIndex("by_week", (q) => q.eq("weekId", week._id))
      .collect();
    return rows.map((row) => [row.userA, row.userB]);
  });
}

async function memberIdsOf(t: Harness, leagueId: Id<"leagues">) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
      .collect();
    return rows.map((row) => row.userId);
  });
}

async function createLeague(
  t: Harness,
  creator: Id<"users">,
  fields: { name?: string; stakeUsd?: number; visibility?: "private" | "public" } = {},
) {
  return await asUser(t, creator).mutation(api.leagues.create, {
    name: fields.name ?? "Test League",
    stakeUsd: fields.stakeUsd ?? 0,
    visibility: fields.visibility ?? "private",
  });
}

async function joinAll(t: Harness, leagueId: Id<"leagues">, userIds: Id<"users">[]) {
  for (const userId of userIds) {
    await t.run(async (ctx) => {
      const league = await ctx.db.get("leagues", leagueId);
      if (league === null) throw new Error("missing league");
      await ctx.db.insert("memberships", { leagueId, userId, paid: true, joinedAt: Date.now() });
    });
  }
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function markAllPaid(t: Harness, leagueId: Id<"leagues">) {
  await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
      .collect();
    for (const row of rows) {
      await ctx.db.patch("memberships", row._id, { paid: true });
    }
  });
}

/** What the Whop webhook writes for a verified payment into the league's current week. */
async function buyIn(t: Harness, leagueId: Id<"leagues">, userId: Id<"users">) {
  await t.run(async (ctx) => {
    const week = await ctx.db
      .query("weeks")
      .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
      .order("desc")
      .first();
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", userId))
      .unique();
    if (week === null || membership === null) throw new Error("missing week or membership");
    await ctx.db.patch("memberships", membership._id, { paid: true });
    await ctx.db.insert("ledger", {
      leagueId,
      weekId: week._id,
      userId,
      kind: "buy_in",
      amountUsd: 20,
      idempotencyKey: `buy_in:${userId}:${week.number}`,
      createdAt: Date.now(),
    });
  });
}

/** Whether each of the player's leagues reads as paid on their own screens. */
async function paidSays(t: Harness, userId: Id<"users">) {
  const me = await asUser(t, userId).query(api.users.me, {});
  return me?.leagues.map((league) => league.paid);
}

async function paidOf(t: Harness, leagueId: Id<"leagues">) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
      .collect();
    return rows.map((row) => row.paid);
  });
}

async function codeOf(t: Harness, leagueId: Id<"leagues">) {
  const league = await t.run((ctx) => ctx.db.get("leagues", leagueId));
  return league!.inviteCode;
}

describe("leagues.create", () => {
  it("makes the creator the first member and opens week 1 for this calendar week", async () => {
    const t = newHarness();
    const creator = await addUser(t, { name: "Ava" });

    const { leagueId, inviteCode } = await createLeague(t, creator, {
      name: "  Dorm 4  ",
      stakeUsd: 5,
      visibility: "public",
    });

    expect(inviteCode).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
    const { league, memberships, weeks } = await t.run(async (ctx) => ({
      league: await ctx.db.get("leagues", leagueId),
      memberships: await ctx.db.query("memberships").collect(),
      weeks: await ctx.db.query("weeks").collect(),
    }));
    expect(league).toMatchObject({
      name: "Dorm 4",
      stakeUsd: 5,
      visibility: "public",
      maxMembers: 12,
      inviteCode,
      createdBy: creator,
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ leagueId, userId: creator, paid: false, joinedAt: NOW });
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({
      leagueId,
      number: 1,
      startsAt: Date.UTC(2026, 10, 16, 8),
      endsAt: Date.UTC(2026, 10, 23, 8),
      status: "open",
    });
    expect(await matchupsOf(t, leagueId)).toEqual([]);
  });

  it("marks the creator paid in a free league", async () => {
    const t = newHarness();
    const creator = await addUser(t);
    const { leagueId } = await createLeague(t, creator, { stakeUsd: 0 });
    const memberships = await t.run((ctx) => ctx.db.query("memberships").collect());
    expect(memberships.find((m) => m.leagueId === leagueId)?.paid).toBe(true);
  });

  it("gives every league its own invite code", async () => {
    const t = newHarness();
    const creator = await addUser(t);
    const codes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      codes.add((await createLeague(t, creator)).inviteCode);
    }
    expect(codes.size).toBe(10);
  });

  it.each([
    ["an empty name", { name: "   ", stakeUsd: 0 }, "Give the league a name"],
    ["a name over 40 characters", { name: "x".repeat(41), stakeUsd: 0 }, "League names are at most 40 characters"],
    ["a negative stake", { name: "Ok", stakeUsd: -1 }, "The stake must be a whole number from $0 to $1000"],
    ["a stake over 1000", { name: "Ok", stakeUsd: 1001 }, "The stake must be a whole number from $0 to $1000"],
    ["a fractional stake", { name: "Ok", stakeUsd: 2.5 }, "The stake must be a whole number from $0 to $1000"],
  ])("rejects %s", async (_label, fields, message) => {
    const t = newHarness();
    const creator = await addUser(t);
    await expect(createLeague(t, creator, fields)).rejects.toMatchObject({ data: message });
    expect(await t.run((ctx) => ctx.db.query("leagues").collect())).toHaveLength(0);
  });

  it("accepts a 40 character name and a $1000 stake", async () => {
    const t = newHarness();
    const creator = await addUser(t);
    await expect(
      createLeague(t, creator, { name: "x".repeat(40), stakeUsd: 1000 }),
    ).resolves.toHaveProperty("leagueId");
  });
});

describe("leagues.joinByCode", () => {
  it("accepts the code in any case with stray spaces", async () => {
    const t = newHarness();
    const [ava, ben] = [await addUser(t), await addUser(t)];
    const { leagueId, inviteCode } = await createLeague(t, ava);

    const joined = await asUser(t, ben).mutation(api.leagues.joinByCode, {
      inviteCode: ` ${inviteCode.toLowerCase()} `,
    });

    expect(joined).toEqual({ leagueId });
    expect(await memberIdsOf(t, leagueId)).toEqual([ava, ben]);
  });

  it("changes nothing when the player is already in the league", async () => {
    const t = newHarness();
    const [ava, ben] = [await addUser(t), await addUser(t)];
    const { leagueId, inviteCode } = await createLeague(t, ava);
    await asUser(t, ben).mutation(api.leagues.joinByCode, { inviteCode });

    const again = await asUser(t, ben).mutation(api.leagues.joinByCode, { inviteCode });
    const creatorAgain = await asUser(t, ava).mutation(api.leagues.joinByCode, { inviteCode });

    expect(again).toEqual({ leagueId });
    expect(creatorAgain).toEqual({ leagueId });
    expect(await memberIdsOf(t, leagueId)).toEqual([ava, ben]);
    expect(await matchupsOf(t, leagueId)).toEqual([[ava, ben]]);
  });

  it("pairs the second member with the first, gives the third an opponent and lets the fourth take the extra pair", async () => {
    const t = newHarness();
    const [ava, ben, cal, dee] = [
      await addUser(t),
      await addUser(t),
      await addUser(t),
      await addUser(t),
    ];
    const { leagueId, inviteCode } = await createLeague(t, ava);

    await asUser(t, ben).mutation(api.leagues.joinByCode, { inviteCode });
    expect(await matchupsOf(t, leagueId)).toEqual([[ava, ben]]);

    await asUser(t, cal).mutation(api.leagues.joinByCode, { inviteCode });
    expect(await matchupsOf(t, leagueId)).toEqual([
      [ava, ben],
      [cal, ava],
    ]);

    await asUser(t, dee).mutation(api.leagues.joinByCode, { inviteCode });
    expect(await matchupsOf(t, leagueId)).toEqual([
      [ava, ben],
      [cal, dee],
    ]);
  });

  it("marks a joiner of a staked league unpaid", async () => {
    const t = newHarness();
    const [ava, ben] = [await addUser(t), await addUser(t)];
    const { leagueId, inviteCode } = await createLeague(t, ava, { stakeUsd: 20 });
    await asUser(t, ben).mutation(api.leagues.joinByCode, { inviteCode });
    const memberships = await t.run((ctx) =>
      ctx.db
        .query("memberships")
        .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", ben))
        .collect(),
    );
    expect(memberships.map((m) => m.paid)).toEqual([false]);
  });

  it("refuses a thirteenth member", async () => {
    const t = newHarness();
    const creator = await addUser(t);
    const { leagueId, inviteCode } = await createLeague(t, creator);
    const others: Id<"users">[] = [];
    for (let i = 0; i < 11; i++) others.push(await addUser(t));
    await joinAll(t, leagueId, others);
    const latecomer = await addUser(t);

    await expect(
      asUser(t, latecomer).mutation(api.leagues.joinByCode, { inviteCode }),
    ).rejects.toMatchObject({ data: "This league is full" });
    expect(await memberIdsOf(t, leagueId)).toHaveLength(12);
  });

  it("rejects an unknown code", async () => {
    const t = newHarness();
    const ava = await addUser(t);
    await expect(
      asUser(t, ava).mutation(api.leagues.joinByCode, { inviteCode: "ZZZZZZ" }),
    ).rejects.toMatchObject({ data: "No league has that invite code" });
  });
});

describe("leagues.quickMatch", () => {
  it("creates a public league named for the stake when none exists", async () => {
    const t = newHarness();
    const ava = await addUser(t);

    const free = await asUser(t, ava).mutation(api.leagues.quickMatch, { stakeUsd: 0 });
    const five = await asUser(t, ava).mutation(api.leagues.quickMatch, { stakeUsd: 5 });
    const twenty = await asUser(t, ava).mutation(api.leagues.quickMatch, { stakeUsd: 20 });

    const leagues = await t.run(async (ctx) => [
      await ctx.db.get("leagues", free.leagueId),
      await ctx.db.get("leagues", five.leagueId),
      await ctx.db.get("leagues", twenty.leagueId),
    ]);
    expect(leagues.map((l) => [l?.name, l?.stakeUsd, l?.visibility])).toEqual([
      ["Quick Match Free", 0, "public"],
      ["Quick Match $5", 5, "public"],
      ["Quick Match $20", 20, "public"],
    ]);
    expect(await memberIdsOf(t, free.leagueId)).toEqual([ava]);
  });

  it("joins the fullest open public league with that stake", async () => {
    const t = newHarness();
    const [ava, ben, cal, dee] = [
      await addUser(t),
      await addUser(t),
      await addUser(t),
      await addUser(t),
    ];
    const emptyish = await createLeague(t, ava, { stakeUsd: 5, visibility: "public" });
    const fuller = await createLeague(t, ben, { stakeUsd: 5, visibility: "public" });
    await asUser(t, cal).mutation(api.leagues.joinByCode, {
      inviteCode: await codeOf(t, fuller.leagueId),
    });

    const matched = await asUser(t, dee).mutation(api.leagues.quickMatch, { stakeUsd: 5 });

    expect(matched.leagueId).toBe(fuller.leagueId);
    expect(await memberIdsOf(t, fuller.leagueId)).toEqual([ben, cal, dee]);
    expect(await memberIdsOf(t, emptyish.leagueId)).toEqual([ava]);
  });

  it("skips leagues the player is in, full leagues, private leagues and other stakes", async () => {
    const t = newHarness();
    const ava = await addUser(t);
    const host = await addUser(t);
    const own = await createLeague(t, ava, { stakeUsd: 5, visibility: "public" });
    const privateOne = await createLeague(t, host, { stakeUsd: 5, visibility: "private" });
    const otherStake = await createLeague(t, host, { stakeUsd: 20, visibility: "public" });
    const full = await createLeague(t, host, { stakeUsd: 5, visibility: "public" });
    const fillers: Id<"users">[] = [];
    for (let i = 0; i < 11; i++) fillers.push(await addUser(t));
    await joinAll(t, full.leagueId, fillers);

    const matched = await asUser(t, ava).mutation(api.leagues.quickMatch, { stakeUsd: 5 });

    const skipped = [own, privateOne, otherStake, full].map((l) => l.leagueId);
    expect(skipped).not.toContain(matched.leagueId);
    const created = await t.run((ctx) => ctx.db.get("leagues", matched.leagueId));
    expect(created).toMatchObject({ name: "Quick Match $5", visibility: "public", stakeUsd: 5 });
    expect(await memberIdsOf(t, matched.leagueId)).toEqual([ava]);
  });

  it("does not match a second time into the same league", async () => {
    const t = newHarness();
    const ava = await addUser(t);
    const first = await asUser(t, ava).mutation(api.leagues.quickMatch, { stakeUsd: 0 });
    const second = await asUser(t, ava).mutation(api.leagues.quickMatch, { stakeUsd: 0 });
    expect(second.leagueId).not.toBe(first.leagueId);
  });
});

describe("leagues.get", () => {
  it("returns the league with its member count and current week", async () => {
    const t = newHarness();
    const [ava, ben, outsider] = [await addUser(t), await addUser(t), await addUser(t)];
    const { leagueId, inviteCode } = await createLeague(t, ava, { name: "Dorm 4", stakeUsd: 5 });
    await asUser(t, ben).mutation(api.leagues.joinByCode, { inviteCode });

    const league = await asUser(t, outsider).query(api.leagues.get, { leagueId });

    expect(league).toMatchObject({
      _id: leagueId,
      name: "Dorm 4",
      inviteCode,
      stakeUsd: 5,
      memberCount: 2,
      week: { number: 1, startsAt: Date.UTC(2026, 10, 16, 8), endsAt: Date.UTC(2026, 10, 23, 8), status: "open" },
    });
  });

  it("keeps showing a past week until the league rolls into the next one", async () => {
    const t = newHarness();
    const ava = await addUser(t);
    const { leagueId } = await createLeague(t, ava);

    vi.setSystemTime(NOW + 8 * 24 * 60 * 60 * 1000);
    const stale = await asUser(t, ava).query(api.leagues.get, { leagueId });
    expect(stale.week.number).toBe(1);
  });

  it("rejects an unknown league", async () => {
    const t = newHarness();
    const ava = await addUser(t);
    const { leagueId } = await createLeague(t, ava);
    await t.run((ctx) => ctx.db.delete("leagues", leagueId));
    await expect(asUser(t, ava).query(api.leagues.get, { leagueId })).rejects.toMatchObject({
      data: "League not found",
    });
  });
});

describe("leagues.startWeek", () => {
  it("rolls the league into the new calendar week with fresh pairings", async () => {
    const t = newHarness();
    const [ava, ben, cal, dee] = [
      await addUser(t),
      await addUser(t),
      await addUser(t),
      await addUser(t),
    ];
    const { leagueId, inviteCode } = await createLeague(t, ava);
    for (const player of [ben, cal, dee]) {
      await asUser(t, player).mutation(api.leagues.joinByCode, { inviteCode });
    }

    vi.setSystemTime(NOW + 7 * 24 * 60 * 60 * 1000);
    await t.mutation(internal.leagues.startWeek, { leagueId });
    await t.mutation(internal.leagues.startWeek, { leagueId });

    const league = await asUser(t, ava).query(api.leagues.get, { leagueId });
    expect(league.week).toMatchObject({
      number: 2,
      startsAt: Date.UTC(2026, 10, 23, 8),
      endsAt: Date.UTC(2026, 10, 30, 8),
    });
    const pairs = await matchupsOf(t, leagueId);
    expect(pairs).toHaveLength(2);
    expect(pairs.flat().sort()).toEqual([ava, ben, cal, dee].sort());
  });

  it("asks every member of a weekly league for the stake again when a week opens", async () => {
    const t = newHarness();
    const [ava, ben] = [await addUser(t), await addUser(t)];
    const { leagueId, inviteCode } = await createLeague(t, ava, { stakeUsd: 20 });
    await asUser(t, ben).mutation(api.leagues.joinByCode, { inviteCode });
    await markAllPaid(t, leagueId);

    await t.mutation(internal.leagues.startWeek, { leagueId });
    expect(await paidOf(t, leagueId)).toEqual([true, true]);

    vi.setSystemTime(NOW + WEEK_MS);
    await t.mutation(internal.leagues.startWeek, { leagueId });
    expect(await paidOf(t, leagueId)).toEqual([false, false]);
  });

  it("holds a season league's stakes until the next season opens", async () => {
    const t = newHarness();
    const [ava, ben] = [await addUser(t), await addUser(t)];
    const { leagueId } = await asUser(t, ava).mutation(api.leagues.create, {
      name: "Season League",
      stakeUsd: 20,
      visibility: "private",
      settings: { payout: "season", seasonWeeks: 2 },
    });
    const inviteCode = await codeOf(t, leagueId);
    await asUser(t, ben).mutation(api.leagues.joinByCode, { inviteCode });
    await markAllPaid(t, leagueId);

    vi.setSystemTime(NOW + WEEK_MS);
    await t.mutation(internal.leagues.startWeek, { leagueId });
    expect(await paidOf(t, leagueId)).toEqual([true, true]);

    vi.setSystemTime(NOW + 2 * WEEK_MS);
    await t.mutation(internal.leagues.startWeek, { leagueId });
    expect(await paidOf(t, leagueId)).toEqual([false, false]);
  });

  it("counts a weekly league's buy-in only in the week it was paid into", async () => {
    const t = newHarness();
    const [ava, ben] = [await addUser(t), await addUser(t)];
    const { leagueId, inviteCode } = await createLeague(t, ava, { stakeUsd: 20 });
    await asUser(t, ben).mutation(api.leagues.joinByCode, { inviteCode });

    await buyIn(t, leagueId, ava);
    expect(await paidSays(t, ava)).toEqual([true]);
    expect(await paidSays(t, ben)).toEqual([false]);

    vi.setSystemTime(NOW + WEEK_MS);
    await t.mutation(internal.leagues.startWeek, { leagueId });
    expect(await paidSays(t, ava)).toEqual([false]);

    await buyIn(t, leagueId, ben);
    expect(await paidSays(t, ben)).toEqual([true]);
  });

  it("counts a season league's buy-in in every week of that season", async () => {
    const t = newHarness();
    const [ava, ben] = [await addUser(t), await addUser(t)];
    const { leagueId } = await asUser(t, ava).mutation(api.leagues.create, {
      name: "Season League",
      stakeUsd: 20,
      visibility: "private",
      settings: { payout: "season", seasonWeeks: 2 },
    });
    await asUser(t, ben).mutation(api.leagues.joinByCode, { inviteCode: await codeOf(t, leagueId) });
    await buyIn(t, leagueId, ava);

    vi.setSystemTime(NOW + WEEK_MS);
    await t.mutation(internal.leagues.startWeek, { leagueId });
    expect(await paidSays(t, ava)).toEqual([true]);
    expect(await paidSays(t, ben)).toEqual([false]);

    vi.setSystemTime(NOW + 2 * WEEK_MS);
    await t.mutation(internal.leagues.startWeek, { leagueId });
    expect(await paidSays(t, ava)).toEqual([false]);
  });

  it("does not take the membership flag's word that a stake was paid", async () => {
    const t = newHarness();
    const ava = await addUser(t);
    const { leagueId } = await createLeague(t, ava, { stakeUsd: 20 });
    await markAllPaid(t, leagueId);

    expect(await paidSays(t, ava)).toEqual([false]);
  });

  it("leaves a free league's members paid", async () => {
    const t = newHarness();
    const [ava, ben] = [await addUser(t), await addUser(t)];
    const { leagueId, inviteCode } = await createLeague(t, ava);
    await asUser(t, ben).mutation(api.leagues.joinByCode, { inviteCode });

    vi.setSystemTime(NOW + WEEK_MS);
    await t.mutation(internal.leagues.startWeek, { leagueId });
    expect(await paidOf(t, leagueId)).toEqual([true, true]);
  });
});
