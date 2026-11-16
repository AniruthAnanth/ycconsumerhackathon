// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { Webhook } from "standardwebhooks";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { weekEndOf, weekStartOf } from "./lib/week";
import { addMemory } from "./memory";
import schema from "./schema";
import { paidBuyIn } from "./whop";

// Closing a week schedules lineup.rememberOutcomes. No test may reach Supermemory, and the fake
// timers hold that scheduled call until a test chooses to run it.
vi.mock("./memory", async (original) => ({
  ...(await original<typeof import("./memory")>()),
  addMemory: vi.fn(),
  searchMemories: vi.fn(),
}));

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
});

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEBHOOK_SECRET = "ws_test_secret_for_unit_tests_only";

/** A $5 league with one unpaid member, in its first week. */
async function leagueWithMember(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Maya" });
    const leagueId = await ctx.db.insert("leagues", {
      name: "YC Hackathon",
      inviteCode: "YC2026",
      stakeUsd: 5,
      visibility: "private",
      maxMembers: 12,
      createdBy: userId,
    });
    await ctx.db.insert("memberships", { leagueId, userId, paid: false, joinedAt: 0 });
    const weekId = await ctx.db.insert("weeks", {
      leagueId,
      number: 1,
      startsAt: 0,
      endsAt: WEEK_MS,
      status: "open",
    });
    return { userId, leagueId, weekId };
  });
}

const paymentSucceeded = (metadata: Record<string, string>, paymentId = "pay_1") => ({
  type: "payment.succeeded",
  data: {
    id: paymentId,
    metadata,
    user: { id: "user_whop1", email: "maya@example.com" },
    member: { id: "mber_whop1" },
    total: 5,
  },
});

/** Signs a body the way Whop does: Standard Webhooks, keyed with the secret's literal bytes. */
function signedRequest(body: string, secret = WEBHOOK_SECRET): RequestInit {
  const id = "msg_1";
  const timestamp = new Date();
  const signature = new Webhook(btoa(secret)).sign(id, timestamp, body);
  return {
    method: "POST",
    body,
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": signature,
    },
  };
}

describe("paidBuyIn", () => {
  test("reads the payment, our metadata and the payer's Whop identity", () => {
    expect(paidBuyIn(paymentSucceeded({ userId: "u1", leagueId: "l1" }))).toEqual({
      whopPaymentId: "pay_1",
      userId: "u1",
      leagueId: "l1",
      whopUserId: "user_whop1",
      whopMemberId: "mber_whop1",
    });
  });

  test("ignores other events and payments that are not Lineup buy-ins", () => {
    expect(paidBuyIn({ type: "payment.failed", data: { id: "pay_1", metadata: {} } })).toBeNull();
    expect(paidBuyIn(paymentSucceeded({ orderId: "someone else's checkout" }))).toBeNull();
    expect(paidBuyIn({ type: "payment.succeeded", data: { id: "pay_1", metadata: null } })).toBeNull();
    expect(paidBuyIn("not an event")).toBeNull();
  });
});

describe("recordBuyIn", () => {
  test("marks the member paid, attaches their Whop identity and writes one buy_in row", async () => {
    const t = convexTest(schema, modules);
    const { userId, leagueId, weekId } = await leagueWithMember(t);

    await t.mutation(internal.whop.recordBuyIn, {
      whopPaymentId: "pay_1",
      userId,
      leagueId,
      whopUserId: "user_whop1",
      whopMemberId: "mber_whop1",
    });

    const state = await t.run(async (ctx) => ({
      membership: await ctx.db.query("memberships").first(),
      user: await ctx.db.get("users", userId),
      ledger: await ctx.db.query("ledger").collect(),
    }));
    expect(state.membership).toMatchObject({
      paid: true,
      whopPaymentId: "pay_1",
      whopAccountId: "mber_whop1",
    });
    expect(state.user?.whopUserId).toBe("user_whop1");
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]).toMatchObject({
      leagueId,
      weekId,
      userId,
      kind: "buy_in",
      amountUsd: 5,
      whopId: "pay_1",
      idempotencyKey: "buy_in:pay_1",
    });
  });

  test("a payment delivered twice is recorded once", async () => {
    const t = convexTest(schema, modules);
    const { userId, leagueId } = await leagueWithMember(t);
    const payment = { whopPaymentId: "pay_1", userId, leagueId };

    await t.mutation(internal.whop.recordBuyIn, payment);
    await t.mutation(internal.whop.recordBuyIn, payment);

    expect(await t.run((ctx) => ctx.db.query("ledger").collect())).toHaveLength(1);
  });

  test("a payment naming nobody in this deployment changes nothing", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await leagueWithMember(t);

    await t.mutation(internal.whop.recordBuyIn, {
      whopPaymentId: "pay_1",
      userId: "u1",
      leagueId,
    });

    const state = await t.run(async (ctx) => ({
      membership: await ctx.db.query("memberships").first(),
      ledger: await ctx.db.query("ledger").collect(),
    }));
    expect(state.membership?.paid).toBe(false);
    expect(state.ledger).toEqual([]);
  });
});

describe("buyInFor", () => {
  test("goes by the ledger, not the membership flag, on who has already paid", async () => {
    const t = convexTest(schema, modules);
    const { userId, leagueId, weekId } = await leagueWithMember(t);
    const member = t.withIdentity({ subject: `${userId}|session` });
    // A flag left set by an earlier week must not block this week's buy-in.
    await t.run(async (ctx) => {
      const membership = await ctx.db.query("memberships").first();
      if (membership) await ctx.db.patch("memberships", membership._id, { paid: true });
    });

    expect(await member.query(internal.whop.buyInFor, { leagueId })).toMatchObject({ userId, stakeUsd: 5 });

    await t.run((ctx) =>
      ctx.db.insert("ledger", {
        leagueId,
        weekId,
        userId,
        kind: "buy_in",
        amountUsd: 5,
        idempotencyKey: "buy_in:pay_1",
        createdAt: 0,
      }),
    );
    await expect(member.query(internal.whop.buyInFor, { leagueId })).rejects.toThrow("already paid");
  });
});

describe("POST /whop", () => {
  beforeEach(() => vi.stubEnv("WHOP_WEBHOOK_SECRET", WEBHOOK_SECRET));
  afterEach(() => vi.unstubAllEnvs());

  test("answers 503 and processes nothing while the secret is unset", async () => {
    vi.stubEnv("WHOP_WEBHOOK_SECRET", "");
    const t = convexTest(schema, modules);
    const { userId, leagueId } = await leagueWithMember(t);
    const body = JSON.stringify(paymentSucceeded({ userId, leagueId }));

    const response = await t.fetch("/whop", signedRequest(body));

    expect(response.status).toBe(503);
    expect((await t.run((ctx) => ctx.db.query("memberships").first()))?.paid).toBe(false);
  });

  test("rejects an event signed with another secret, or changed after signing", async () => {
    const t = convexTest(schema, modules);
    const { userId, leagueId } = await leagueWithMember(t);
    const body = JSON.stringify(paymentSucceeded({ userId, leagueId }));

    const wrongSecret = await t.fetch("/whop", signedRequest(body, "ws_someone_elses_secret"));
    const tampered = await t.fetch("/whop", {
      ...signedRequest(body),
      body: body.replace("pay_1", "pay_2"),
    });
    const unsigned = await t.fetch("/whop", { method: "POST", body });

    expect([wrongSecret.status, tampered.status, unsigned.status]).toEqual([401, 401, 401]);
    expect((await t.run((ctx) => ctx.db.query("memberships").first()))?.paid).toBe(false);
  });

  test("a verified payment.succeeded marks the member paid", async () => {
    const t = convexTest(schema, modules);
    const { userId, leagueId } = await leagueWithMember(t);
    const body = JSON.stringify(paymentSucceeded({ userId, leagueId }));

    const response = await t.fetch("/whop", signedRequest(body));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "recorded" });
    expect((await t.run((ctx) => ctx.db.query("memberships").first()))?.paid).toBe(true);
  });

  test("acknowledges verified events it has no use for", async () => {
    const t = convexTest(schema, modules);
    const body = JSON.stringify({ type: "membership.activated", data: { id: "mem_1" } });

    const response = await t.fetch("/whop", signedRequest(body));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "ignored" });
  });
});

// ---- Settlement ---------------------------------------------------------------------------------

type Member = {
  name: string;
  /** Has a buy_in row in the ledger for week 1. */
  boughtIn?: boolean;
  /** Verified tasks in all five roster slots. */
  clearedFive?: boolean;
  /** Slots cleared when not all five: Body alone unless set (0 clears none). */
  slots?: number;
  points?: number;
  whopUserId?: string;
};

const CORE = ["body", "mind", "recharge", "chores", "people"] as const;

/** A $5 league in week 1 with these members, each with one week of verified tasks. */
async function leagueOf(
  t: ReturnType<typeof convexTest>,
  members: Member[],
  settings: { payout?: "weekly" | "season"; seasonWeeks?: number; whopCompanyId?: string; mode?: "versus" } = {},
) {
  return await t.run(async (ctx) => {
    const userIds: Record<string, Id<"users">> = {};
    for (const member of members) {
      userIds[member.name] = await ctx.db.insert("users", {
        name: member.name,
        whopUserId: member.whopUserId,
      });
    }
    const leagueId = await ctx.db.insert("leagues", {
      name: "YC Hackathon",
      inviteCode: "YC2026",
      stakeUsd: 5,
      visibility: "private",
      maxMembers: 12,
      createdBy: userIds[members[0].name],
      ...settings,
    });
    const weekId = await ctx.db.insert("weeks", {
      leagueId,
      number: 1,
      startsAt: 0,
      endsAt: WEEK_MS,
      status: "open",
    });
    for (const member of members) {
      const userId = userIds[member.name];
      await ctx.db.insert("memberships", {
        leagueId,
        userId,
        paid: member.boughtIn ?? false,
        joinedAt: 0,
      });
      if (member.boughtIn) {
        await ctx.db.insert("ledger", {
          leagueId,
          weekId,
          userId,
          kind: "buy_in",
          amountUsd: 5,
          whopId: `pay_${member.name}`,
          idempotencyKey: `buy_in:pay_${member.name}`,
          createdAt: 0,
        });
      }
    }
    return { leagueId, weekId, userIds };
  });
}

/** Verified tasks for one member's week: every roster slot, or Body alone. All points sit on Body. */
async function playWeek(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  weekStart: number,
  { clearedFive = false, slots = 1, points = 0 }: Pick<Member, "clearedFive" | "slots" | "points">,
) {
  await t.run(async (ctx) => {
    for (const slot of clearedFive ? CORE : CORE.slice(0, slots)) {
      await ctx.db.insert("tasks", {
        userId,
        weekStart,
        slot,
        title: slot,
        points: slot === "body" ? points : 0,
        proofType: "photo",
        status: "verified",
        source: "draft",
      });
    }
  });
}

async function leagueAfterWeekOne(
  t: ReturnType<typeof convexTest>,
  members: Member[],
  settings?: Parameters<typeof leagueOf>[2],
) {
  const league = await leagueOf(t, members, settings);
  for (const member of members) await playWeek(t, league.userIds[member.name], 0, member);
  return league;
}

const settlementRows = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) =>
    (await ctx.db.query("ledger").collect())
      .filter((row) => row.kind !== "buy_in")
      .map(({ userId, kind, amountUsd, idempotencyKey, whopId }) => ({
        userId,
        kind,
        amountUsd,
        idempotencyKey,
        whopId,
      })),
  );

const FOUR_PLAYERS: Member[] = [
  { name: "maya", boughtIn: true, clearedFive: true, points: 300, whopUserId: "user_maya" },
  { name: "sam", boughtIn: true, clearedFive: true, points: 100 },
  { name: "ana", boughtIn: true, points: 500 },
  { name: "leo", clearedFive: true, points: 900 },
];

describe("closeWeek", () => {
  test("splits the whole pot evenly among the top performers into escrow, and settles the week", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, weekId, userIds } = await leagueAfterWeekOne(t, FOUR_PLAYERS);

    await t.mutation(internal.whop.closeWeek, { leagueId });

    // Maya and Sam cleared all five, the most anyone cleared, so they split the $15 pot evenly
    // whatever their points. Ana cleared one. Leo cleared five but never bought in.
    const rows = await settlementRows(t);
    expect(rows).toEqual([
      { userId: userIds.maya, kind: "winnings", amountUsd: 7.5, idempotencyKey: `${weekId}:${userIds.maya}:winnings` },
      { userId: userIds.sam, kind: "winnings", amountUsd: 7.5, idempotencyKey: `${weekId}:${userIds.sam}:winnings` },
    ]);
    expect(Math.round(rows.reduce((sum, row) => sum + row.amountUsd, 0) * 100)).toBe(1500);
    expect((await t.run((ctx) => ctx.db.get("weeks", weekId)))?.status).toBe("settled");
  });

  test("when the most anyone cleared is four, those with four split the pot", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await leagueAfterWeekOne(t, [
      { name: "maya", boughtIn: true, slots: 4, points: 300 },
      { name: "sam", boughtIn: true, slots: 4, points: 110 },
      { name: "ana", boughtIn: true, slots: 3, points: 500 },
    ]);

    await t.mutation(internal.whop.closeWeek, { leagueId });

    const winnings = (await settlementRows(t)).filter((row) => row.kind === "winnings");
    expect(winnings.map((row) => [row.userId, row.amountUsd])).toEqual([
      [userIds.maya, 7.5],
      [userIds.sam, 7.5],
    ]);
  });

  test("everyone clearing all five splits the pot evenly, and an unpaid member shares nothing", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await leagueAfterWeekOne(t, [
      { name: "maya", boughtIn: true, clearedFive: true },
      { name: "sam", boughtIn: true, clearedFive: true },
      { name: "ana", boughtIn: true, clearedFive: true },
      { name: "leo", clearedFive: true, points: 900 },
    ]);

    await t.mutation(internal.whop.closeWeek, { leagueId });

    const rows = await settlementRows(t);
    expect(rows.map((row) => [row.userId, row.kind, row.amountUsd])).toEqual([
      [userIds.maya, "winnings", 5],
      [userIds.sam, "winnings", 5],
      [userIds.ana, "winnings", 5],
    ]);
  });

  test("a week ended early is over from that moment; one settled after its end keeps its end", async () => {
    const t = convexTest(schema, modules);
    const early = await leagueAfterWeekOne(t, FOUR_PLAYERS);
    const sunday = Date.now() + WEEK_MS;
    await t.run((ctx) => ctx.db.patch("weeks", early.weekId, { endsAt: sunday }));
    const late = await leagueAfterWeekOne(t, [{ name: "zoe" }]);

    await t.mutation(internal.whop.closeWeek, { leagueId: early.leagueId });
    await t.mutation(internal.whop.closeWeek, { leagueId: late.leagueId });

    const endOf = async (weekId: Id<"weeks">) => (await t.run((ctx) => ctx.db.get("weeks", weekId)))?.endsAt;
    expect(await endOf(early.weekId)).toBeLessThanOrEqual(Date.now());
    expect(await endOf(late.weekId)).toBe(WEEK_MS);
  });

  test("run twice, it pays nobody twice", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await leagueAfterWeekOne(t, FOUR_PLAYERS);

    await t.mutation(internal.whop.closeWeek, { leagueId });
    const once = await settlementRows(t);
    await t.mutation(internal.whop.closeWeek, { leagueId });

    expect(await settlementRows(t)).toEqual(once);
  });

  test("schedules remembering the week's outcomes and closing its drops once, when the week closes", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await leagueAfterWeekOne(t, FOUR_PLAYERS);

    await t.mutation(internal.whop.closeWeek, { leagueId });
    await t.mutation(internal.whop.closeWeek, { leagueId });

    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map(({ name, args }) => ({ name, args }))).toEqual([
      { name: "lineup:rememberOutcomes", args: [{ leagueId, weekStart: 0 }] },
      { name: "drops:closeForWeek", args: [{ leagueId, weekStart: 0 }] },
    ]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(addMemory).toHaveBeenCalled();
  });

  test("keeps winnings in escrow before the season's last week: nothing is owed on Whop", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await leagueAfterWeekOne(t, FOUR_PLAYERS, { whopCompanyId: "biz_league" });

    expect(await t.mutation(internal.whop.closeWeek, { leagueId })).toEqual({
      whopCompanyId: "biz_league",
      refunds: [],
      transfers: [],
    });
  });

  test("cashes out the escrow as one transfer per member at the season's end, until Whop has accepted it", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, weekId, userIds } = await leagueAfterWeekOne(t, FOUR_PLAYERS, {
      whopCompanyId: "biz_league",
      seasonWeeks: 1,
    });

    const first = await t.mutation(internal.whop.closeWeek, { leagueId });

    expect(first.whopCompanyId).toBe("biz_league");
    expect(first.refunds).toEqual([]);
    // Sam is owed his share too, but has no Whop user to send it to.
    expect(first.transfers.map(({ ledgerIds: _, ...transfer }) => transfer)).toEqual([
      { whopUserId: "user_maya", amountUsd: 7.5, idempotenceKey: `${weekId}:${userIds.maya}` },
    ]);

    await t.mutation(internal.whop.recordPaid, {
      ledgerIds: first.transfers[0].ledgerIds,
      whopId: "ctt_1",
    });
    const second = await t.mutation(internal.whop.closeWeek, { leagueId });

    expect(second).toEqual({ whopCompanyId: "biz_league", refunds: [], transfers: [] });
  });

  test("with nothing cleared by a paid member the pot rolls into next week, and the next winner takes it", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, weekId, userIds } = await leagueAfterWeekOne(t, [
      { name: "maya", boughtIn: true, slots: 0, points: 40 },
      { name: "sam", boughtIn: true, slots: 0 },
      { name: "leo", clearedFive: true },
    ]);

    await t.mutation(internal.whop.closeWeek, { leagueId });
    expect((await settlementRows(t)).map(({ kind, amountUsd }) => ({ kind, amountUsd }))).toEqual([
      { kind: "rollover", amountUsd: 10 },
    ]);

    // Week 2: Maya buys in again and clears a slot, so she takes her $5 and the $10 carried in.
    const nextWeekId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("weeks", { leagueId, number: 2, startsAt: WEEK_MS, endsAt: 2 * WEEK_MS, status: "open" });
      await ctx.db.insert("ledger", { leagueId, weekId: id, userId: userIds.maya, kind: "buy_in", amountUsd: 5, idempotencyKey: "buy_in:w2", createdAt: 0 });
      return id;
    });
    await playWeek(t, userIds.maya, WEEK_MS, { slots: 1 });
    await t.mutation(internal.whop.closeWeek, { leagueId, weekId: nextWeekId });

    const rows = (await settlementRows(t)).filter((row) => row.idempotencyKey.startsWith(nextWeekId));
    expect(rows.map(({ userId, kind, amountUsd }) => [userId, kind, amountUsd])).toEqual([
      [userIds.maya, "winnings", 15],
      [undefined, "rollover", -10],
    ]);
    expect(weekId).not.toBe(nextWeekId);
  });

  test("a week nobody bought into settles with no money rows", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, weekId } = await leagueAfterWeekOne(t, [
      { name: "maya", clearedFive: true, points: 90 },
    ]);

    await t.mutation(internal.whop.closeWeek, { leagueId });

    expect(await settlementRows(t)).toEqual([]);
    expect((await t.run((ctx) => ctx.db.get("weeks", weekId)))?.status).toBe("settled");
  });

  test("a drop task from another league scores nothing here", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await leagueAfterWeekOne(t, [
      { name: "maya", boughtIn: true, clearedFive: true, points: 10 },
      { name: "sam", boughtIn: true, clearedFive: true, points: 10 },
      { name: "ana", boughtIn: true },
    ]);
    await t.run(async (ctx) => {
      const otherLeagueId = await ctx.db.insert("leagues", {
        name: "Elsewhere",
        inviteCode: "OTHER1",
        stakeUsd: 0,
        visibility: "private",
        maxMembers: 12,
        createdBy: userIds.maya,
      });
      const dropId = await ctx.db.insert("drops", {
        leagueId: otherLeagueId,
        kind: "quicktime",
        title: "20 push-ups",
        slot: "body",
        points: 500,
        opensAt: 0,
        closesAt: 1,
        status: "closed",
      });
      await ctx.db.insert("tasks", {
        userId: userIds.maya,
        weekStart: 0,
        slot: "body",
        title: "20 push-ups",
        points: 500,
        proofType: "photo",
        status: "verified",
        source: "drop",
        dropId,
      });
    });

    await t.mutation(internal.whop.closeWeek, { leagueId });

    // The drop's 500 points belong to the other league. Maya and Sam both cleared five, so they split $15.
    const winnings = (await settlementRows(t)).filter((row) => row.kind === "winnings");
    expect(winnings.map((row) => row.amountUsd)).toEqual([7.5, 7.5]);
  });
});

describe("closeWeek on the seeded demo league", () => {
  test("End Week Now pays every seeded stake back out, with no Whop transfer owed", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.seed.reset, {});
    const league = await t.run((ctx) =>
      ctx.db
        .query("leagues")
        .withIndex("by_inviteCode", (q) => q.eq("inviteCode", "YCHACK"))
        .unique(),
    );
    if (league === null) throw new Error("The seeded league is missing");
    const buyIns = await t.run(async (ctx) =>
      (await ctx.db.query("ledger").collect()).filter((row) => row.kind === "buy_in"),
    );
    expect(buyIns.length).toBeGreaterThan(0);

    const owed = await t.mutation(internal.whop.closeWeek, { leagueId: league._id });

    const rows = await settlementRows(t);
    const cents = (usd: number) => Math.round(usd * 100);
    expect(rows.reduce((sum, row) => sum + cents(row.amountUsd), 0)).toBe(
      buyIns.reduce((sum, row) => sum + cents(row.amountUsd), 0),
    );
    expect(new Set(rows.map((row) => row.idempotencyKey)).size).toBe(rows.length);
    // Seeded players never went through Whop, so their payouts are shown from the ledger alone.
    expect(owed).toEqual({ whopCompanyId: null, refunds: [], transfers: [] });
  });
});

describe("closeWeek in a season league", () => {
  const SEASON = { payout: "season" as const, seasonWeeks: 2 };
  const PLAYERS: Member[] = [
    { name: "maya", boughtIn: true, clearedFive: true, points: 100 },
    { name: "sam", boughtIn: true, clearedFive: true, points: 100 },
    { name: "ana", boughtIn: true, points: 300 },
  ];

  test("holds every stake until the final week, then settles once on season totals", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, weekId, userIds } = await leagueAfterWeekOne(t, PLAYERS, SEASON);

    await t.mutation(internal.whop.closeWeek, { leagueId });

    expect(await settlementRows(t)).toEqual([]);
    expect((await t.run((ctx) => ctx.db.get("weeks", weekId)))?.status).toBe("settled");

    // Week 2, the season's last: Maya clears her five again and pulls ahead; Sam does not, but
    // one week out of two still makes him a finisher. Ana never clears hers.
    const finalWeekId = await t.run((ctx) =>
      ctx.db.insert("weeks", {
        leagueId,
        number: 2,
        startsAt: WEEK_MS,
        endsAt: 2 * WEEK_MS,
        status: "open",
      }),
    );
    await playWeek(t, userIds.maya, WEEK_MS, { clearedFive: true, points: 200 });
    await playWeek(t, userIds.sam, WEEK_MS, { points: 0 });
    await playWeek(t, userIds.ana, WEEK_MS, { points: 300 });

    await t.mutation(internal.whop.closeWeek, { leagueId });
    await t.mutation(internal.whop.closeWeek, { leagueId });

    // Over the season Maya cleared ten slots, Sam six and Ana two: Maya alone takes the $15 pot.
    const season = `${leagueId}:season`;
    expect(await settlementRows(t)).toEqual([
      { userId: userIds.maya, kind: "winnings", amountUsd: 15, idempotencyKey: `${season}:${userIds.maya}:winnings` },
    ]);
    expect((await t.run((ctx) => ctx.db.get("weeks", finalWeekId)))?.status).toBe("settled");
  });
});

/** Gives every test of the describe it is called in a sandbox key for the Whop client. */
function withWhopSandbox() {
  beforeEach(() => {
    vi.stubEnv("WHOP_API_KEY", "apik_unit_test");
    vi.stubEnv("WHOP_ENVIRONMENT", "sandbox");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
}

/** Stubs Whop's API and records each request as "METHOD path". */
function whopAnswers(answer: () => Response) {
  const requests: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    expect(request.url.startsWith("https://sandbox-api.whop.com/")).toBe(true);
    requests.push(`${request.method} ${new URL(request.url).pathname.replace("/api/v1", "")}`);
    return answer();
  });
  return requests;
}

const whopAccepts = () => Response.json({ id: "ctt_1", object: "transfer" });
const whopRefuses = () =>
  Response.json(
    { error: { type: "bad_request", message: "Please verify your business before transferring funds." } },
    { status: 400 },
  );

describe("settleWeek", () => {
  withWhopSandbox();

  /** Signs the caller in the way Convex Auth does: the subject is "userId|sessionId". */
  const as = (t: ReturnType<typeof convexTest>, userId: Id<"users">) =>
    t.withIdentity({ subject: `${userId}|session` });

  test("keeps the ledger rows when Whop refuses the cashout, and retries on the next call", async () => {
    const requests = whopAnswers(whopRefuses);
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await leagueAfterWeekOne(t, FOUR_PLAYERS, {
      whopCompanyId: "biz_league",
      seasonWeeks: 1,
    });

    await as(t, userIds.maya).action(api.whop.settleWeek, { leagueId });
    await as(t, userIds.maya).action(api.whop.settleWeek, { leagueId });

    const rows = await settlementRows(t);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.whopId === undefined)).toBe(true);
    // Only Maya has a Whop user to cash out to.
    expect(requests).toEqual(["POST /transfers", "POST /transfers"]);
  });

  test("cashes out the escrow at the season's end once, and never twice", async () => {
    const requests = whopAnswers(whopAccepts);
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await leagueAfterWeekOne(t, FOUR_PLAYERS, {
      whopCompanyId: "biz_league",
      seasonWeeks: 1,
    });

    await as(t, userIds.maya).action(api.whop.settleWeek, { leagueId });
    await as(t, userIds.maya).action(api.whop.settleWeek, { leagueId });

    // Sam has no Whop user, so his share stays a ledger row with nothing sent.
    expect((await settlementRows(t)).map(({ userId, kind, whopId }) => ({ userId, kind, whopId }))).toEqual([
      { userId: userIds.maya, kind: "winnings", whopId: "ctt_1" },
      { userId: userIds.sam, kind: "winnings", whopId: undefined },
    ]);
    expect(requests).toEqual(["POST /transfers"]);
  });

  test("refuses a caller who is not in the league", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await leagueAfterWeekOne(t, FOUR_PLAYERS);
    const strangerId = await t.run((ctx) => ctx.db.insert("users", { name: "Stranger" }));

    await expect(as(t, strangerId).action(api.whop.settleWeek, { leagueId })).rejects.toThrow(
      "Only a member",
    );
    expect(await settlementRows(t)).toEqual([]);
  });
});

describe("GET /whop/checkout", () => {
  withWhopSandbox();

  test("serves the checkout page for a Whop checkout id, and tells it when the buyer has come back", async () => {
    const t = convexTest(schema, modules);

    const fresh = await t.fetch("/whop/checkout?ch=ch_8Ux4kgefzRCyCgl");
    expect(fresh.status).toBe(200);
    expect(fresh.headers.get("Content-Type")).toContain("text/html");
    const html = await fresh.text();
    expect(html).toContain('checkoutConfiguration: "ch_8Ux4kgefzRCyCgl"');
    expect(html).toContain("const returned = null;");

    const back = await t.fetch("/whop/checkout?ch=ch_8Ux4kgefzRCyCgl&payment=pay_1&status=succeeded");
    expect(await back.text()).toContain('const returned = "succeeded";');
  });

  test("answers 404 to anything that is not a checkout id", async () => {
    const t = convexTest(schema, modules);

    expect((await t.fetch("/whop/checkout")).status).toBe(404);
    expect((await t.fetch("/whop/checkout?ch=" + encodeURIComponent('ch_1";alert(1)//'))).status).toBe(404);
  });

  test("answers 503 outside the sandbox", async () => {
    vi.stubEnv("WHOP_ENVIRONMENT", "production");
    const t = convexTest(schema, modules);

    expect((await t.fetch("/whop/checkout?ch=ch_8Ux4kgefzRCyCgl")).status).toBe(503);
  });
});

describe("closeWeek after a league's first season", () => {
  test("the second season settles under its own keys, so it is paid out as well", async () => {
    const t = convexTest(schema, modules);
    const players: Member[] = [
      { name: "maya", boughtIn: true, clearedFive: true, points: 100 },
      { name: "sam", boughtIn: true, clearedFive: true, points: 100 },
    ];
    const { leagueId, userIds } = await leagueAfterWeekOne(t, players, { payout: "season", seasonWeeks: 1 });
    await t.mutation(internal.whop.closeWeek, { leagueId });

    // Season 2 is week 2 of this league: both buy in again, and both clear their five.
    await t.run(async (ctx) => {
      const weekId = await ctx.db.insert("weeks", {
        leagueId,
        number: 2,
        startsAt: WEEK_MS,
        endsAt: 2 * WEEK_MS,
        status: "open",
      });
      for (const name of ["maya", "sam"]) {
        await ctx.db.insert("ledger", {
          leagueId,
          weekId,
          userId: userIds[name],
          kind: "buy_in",
          amountUsd: 5,
          idempotencyKey: `buy_in:pay_${name}_2`,
          createdAt: 0,
        });
      }
    });
    for (const name of ["maya", "sam"]) {
      await playWeek(t, userIds[name], WEEK_MS, { clearedFive: true, points: 100 });
    }
    await t.mutation(internal.whop.closeWeek, { leagueId });

    expect((await settlementRows(t)).map((row) => row.idempotencyKey)).toEqual([
      `${leagueId}:season:${userIds.maya}:winnings`,
      `${leagueId}:season:${userIds.sam}:winnings`,
      `${leagueId}:season-2:${userIds.maya}:winnings`,
      `${leagueId}:season-2:${userIds.sam}:winnings`,
    ]);
  });
});

describe("endWeek", () => {
  withWhopSandbox();

  const weeksOf = (t: ReturnType<typeof convexTest>) =>
    t.run(async (ctx) =>
      (await ctx.db.query("weeks").collect()).map(({ number, status, startsAt }) => ({ number, status, startsAt })),
    );
  const paidFlags = (t: ReturnType<typeof convexTest>) =>
    t.run(async (ctx) => (await ctx.db.query("memberships").collect()).map((membership) => membership.paid));

  test("leaves a league alone while the calendar is still in its latest week, settled early or not", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, weekId } = await leagueAfterWeekOne(t, FOUR_PLAYERS);
    const startsAt = weekStartOf(Date.now());
    await t.run((ctx) => ctx.db.patch("weeks", weekId, { startsAt, endsAt: weekEndOf(startsAt) }));

    await t.action(internal.whop.endWeek, { leagueId });

    expect(await weeksOf(t)).toEqual([{ number: 1, status: "open", startsAt }]);
    expect(await settlementRows(t)).toEqual([]);

    // End Week Now on a Wednesday: the next week still opens on Monday, not now.
    await t.mutation(internal.whop.closeWeek, { leagueId });
    await t.action(internal.whop.endWeek, { leagueId });

    expect(await weeksOf(t)).toEqual([{ number: 1, status: "settled", startsAt }]);
  });

  test("once the week has run out, settles it, opens the next with its matchups and makes the stake due again", async () => {
    const requests = whopAnswers(whopAccepts);
    const t = convexTest(schema, modules);
    const { leagueId } = await leagueAfterWeekOne(t, FOUR_PLAYERS, { whopCompanyId: "biz_league" });

    await t.action(internal.whop.endWeek, { leagueId });
    await t.action(internal.whop.endWeek, { leagueId });

    expect(await weeksOf(t)).toEqual([
      { number: 1, status: "settled", startsAt: 0 },
      { number: 2, status: "open", startsAt: weekStartOf(Date.now()) },
    ]);
    // Four members make two pairs, and week 1 had no matchup rows in this league.
    expect(await t.run((ctx) => ctx.db.query("matchups").collect())).toHaveLength(2);
    expect(await paidFlags(t)).toEqual([false, false, false, false]);
    expect(await settlementRows(t)).toHaveLength(2);
    // Week 1 of 8: the shares wait in escrow, and nothing moves on Whop until the season ends.
    expect(requests).toEqual([]);
  });

  test("a season league rolls on without paying, or asking for a new stake, until its last week", async () => {
    whopAnswers(whopAccepts);
    const t = convexTest(schema, modules);
    const { leagueId } = await leagueAfterWeekOne(t, FOUR_PLAYERS, { payout: "season", seasonWeeks: 2 });

    await t.action(internal.whop.endWeek, { leagueId });

    expect(await weeksOf(t)).toMatchObject([
      { number: 1, status: "settled" },
      { number: 2, status: "open" },
    ]);
    expect(await settlementRows(t)).toEqual([]);
    expect(await paidFlags(t)).toEqual([true, true, true, false]);

    // The season's last week runs out too: one settlement over both weeks, then season 2 opens
    // with every stake due again.
    await t.run(async (ctx) => {
      const [, weekTwo] = await ctx.db.query("weeks").collect();
      await ctx.db.patch("weeks", weekTwo._id, { startsAt: WEEK_MS, endsAt: 2 * WEEK_MS });
    });
    await t.action(internal.whop.endWeek, { leagueId });

    expect(await weeksOf(t)).toMatchObject([
      { number: 1, status: "settled" },
      { number: 2, status: "settled" },
      { number: 3, status: "open" },
    ]);
    const keys = (await settlementRows(t)).map((row) => row.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => key.startsWith(`${leagueId}:season:`))).toBe(true);
    expect(await paidFlags(t)).toEqual([false, false, false, false]);
  });

  test("a versus game is settled when its week runs out, and no second week opens", async () => {
    const requests = whopAnswers(whopAccepts);
    const t = convexTest(schema, modules);
    const rivals: Member[] = [
      { name: "maya", boughtIn: true, points: 300 },
      { name: "sam", boughtIn: true, points: 100 },
    ];
    const { leagueId } = await leagueAfterWeekOne(t, rivals, { mode: "versus" });

    await t.action(internal.whop.endWeek, { leagueId });
    const sent = requests.length;
    await t.action(internal.whop.endWeek, { leagueId });

    expect(await weeksOf(t)).toEqual([{ number: 1, status: "settled", startsAt: 0 }]);
    const cents = (await settlementRows(t)).reduce((sum, row) => sum + Math.round(row.amountUsd * 100), 0);
    expect(cents).toBe(1000);
    expect(requests).toHaveLength(sent);
  });
});

describe("retryPayouts", () => {
  withWhopSandbox();

  test("sends an earlier season's unsent cashout once the league has moved on, and sends nothing twice", async () => {
    let answer = whopRefuses;
    const requests = whopAnswers(() => answer());
    const t = convexTest(schema, modules);
    const { leagueId, weekId, userIds } = await leagueAfterWeekOne(t, FOUR_PLAYERS, {
      whopCompanyId: "biz_league",
      seasonWeeks: 1,
    });
    await t.action(internal.whop.endWeek, { leagueId });
    answer = whopAccepts;
    // The league is in week 2 now, so the week's end no longer reaches week 1.
    await t.action(internal.whop.endWeek, { leagueId });
    expect(requests).toHaveLength(1);

    await t.action(internal.whop.retryPayouts, { leagueId, weekId });
    await t.action(internal.whop.retryPayouts, { leagueId, weekId });

    expect((await settlementRows(t)).map(({ userId, kind, whopId }) => ({ userId, kind, whopId }))).toEqual([
      { userId: userIds.maya, kind: "winnings", whopId: "ctt_1" },
      { userId: userIds.sam, kind: "winnings", whopId: undefined },
    ]);
    expect(requests).toHaveLength(2);
    const weeks = await t.run((ctx) => ctx.db.query("weeks").collect());
    expect(weeks.map((week) => week.status)).toEqual(["settled", "open"]);
  });

  test("refuses a week that belongs to another league", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await leagueAfterWeekOne(t, FOUR_PLAYERS);
    const other = await leagueWithMember(t);

    await expect(t.action(internal.whop.retryPayouts, { leagueId, weekId: other.weekId })).rejects.toThrow(
      "not this league's",
    );
    expect(await settlementRows(t)).toEqual([]);
  });
});
