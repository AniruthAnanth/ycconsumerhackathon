// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { Webhook } from "standardwebhooks";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { paidBuyIn } from "./whop";

const modules = import.meta.glob("./**/*.ts");

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
    expect((await t.run((ctx) => ctx.db.query("memberships").first()))?.paid).toBe(true);
  });

  test("acknowledges verified events it has no use for", async () => {
    const t = convexTest(schema, modules);
    const body = JSON.stringify({ type: "membership.activated", data: { id: "mem_1" } });

    const response = await t.fetch("/whop", signedRequest(body));

    expect(response.status).toBe(200);
  });
});

// ---- Settlement ---------------------------------------------------------------------------------

type Member = {
  name: string;
  /** Has a buy_in row in the ledger for week 1. */
  boughtIn?: boolean;
  /** Verified tasks in all five roster slots. */
  clearedFive?: boolean;
  points?: number;
  whopUserId?: string;
};

const CORE = ["body", "mind", "recharge", "chores", "people"] as const;

/** A $5 league in week 1 with these members, each with one week of verified tasks. */
async function leagueOf(
  t: ReturnType<typeof convexTest>,
  members: Member[],
  settings: { payout?: "weekly" | "season"; seasonWeeks?: number; whopCompanyId?: string } = {},
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
  { clearedFive = false, points = 0 }: Pick<Member, "clearedFive" | "points">,
) {
  await t.run(async (ctx) => {
    for (const slot of clearedFive ? CORE : CORE.slice(0, 1)) {
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
  test("writes refund, winnings and fee rows that sum to the buy-ins, and settles the week", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, weekId, userIds } = await leagueAfterWeekOne(t, FOUR_PLAYERS);

    await t.mutation(internal.whop.closeWeek, { leagueId });

    // Ana forfeits $5: 50c fee, $4.50 split 3:1 between Maya and Sam. Leo never bought in.
    const rows = await settlementRows(t);
    expect(rows).toEqual([
      { userId: userIds.maya, kind: "refund", amountUsd: 5, idempotencyKey: `${weekId}:${userIds.maya}:refund` },
      { userId: userIds.maya, kind: "winnings", amountUsd: 3.38, idempotencyKey: `${weekId}:${userIds.maya}:winnings` },
      { userId: userIds.sam, kind: "refund", amountUsd: 5, idempotencyKey: `${weekId}:${userIds.sam}:refund` },
      { userId: userIds.sam, kind: "winnings", amountUsd: 1.12, idempotencyKey: `${weekId}:${userIds.sam}:winnings` },
      { userId: undefined, kind: "fee", amountUsd: 0.5, idempotencyKey: `${weekId}:fee` },
    ]);
    expect(Math.round(rows.reduce((sum, row) => sum + row.amountUsd, 0) * 100)).toBe(1500);
    expect((await t.run((ctx) => ctx.db.get("weeks", weekId)))?.status).toBe("settled");
  });

  test("run twice, it pays nobody twice", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await leagueAfterWeekOne(t, FOUR_PLAYERS);

    await t.mutation(internal.whop.closeWeek, { leagueId });
    const once = await settlementRows(t);
    await t.mutation(internal.whop.closeWeek, { leagueId });

    expect(await settlementRows(t)).toEqual(once);
  });

  test("owes one transfer per member with a Whop user, until Whop has accepted it", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, weekId, userIds } = await leagueAfterWeekOne(t, FOUR_PLAYERS, {
      whopCompanyId: "biz_league",
    });

    const first = await t.mutation(internal.whop.closeWeek, { leagueId });

    // Sam is owed money too, but never paid through Whop, so there is nowhere to send it.
    expect(first.whopCompanyId).toBe("biz_league");
    expect(first.transfers).toHaveLength(1);
    expect(first.transfers[0]).toMatchObject({
      whopUserId: "user_maya",
      amountUsd: 8.38,
      idempotenceKey: `${weekId}:${userIds.maya}`,
    });
    expect(first.transfers[0].ledgerIds).toHaveLength(2);

    await t.mutation(internal.whop.recordTransfer, {
      ledgerIds: first.transfers[0].ledgerIds,
      whopTransferId: "ctt_1",
    });
    const second = await t.mutation(internal.whop.closeWeek, { leagueId });

    expect(second.transfers).toEqual([]);
    const sent = (await settlementRows(t)).filter((row) => row.whopId === "ctt_1");
    expect(sent.map((row) => row.kind)).toEqual(["refund", "winnings"]);
  });

  test("with no finishers every buy-in is refunded and no fee is taken", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await leagueAfterWeekOne(t, [
      { name: "maya", boughtIn: true, points: 40 },
      { name: "sam", boughtIn: true },
    ]);

    await t.mutation(internal.whop.closeWeek, { leagueId });

    expect((await settlementRows(t)).map(({ kind, amountUsd }) => ({ kind, amountUsd }))).toEqual([
      { kind: "refund", amountUsd: 5 },
      { kind: "refund", amountUsd: 5 },
    ]);
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
        sealed: false,
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

    // Level on 10 points each in this league, so Ana's $4.50 is split evenly.
    const winnings = (await settlementRows(t)).filter((row) => row.kind === "winnings");
    expect(winnings.map((row) => row.amountUsd)).toEqual([2.25, 2.25]);
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

    // Ana's $5 is forfeited: 50c fee, $4.50 split 300:100.
    const season = `${leagueId}:season`;
    expect(await settlementRows(t)).toEqual([
      { userId: userIds.maya, kind: "refund", amountUsd: 5, idempotencyKey: `${season}:${userIds.maya}:refund` },
      { userId: userIds.maya, kind: "winnings", amountUsd: 3.38, idempotencyKey: `${season}:${userIds.maya}:winnings` },
      { userId: userIds.sam, kind: "refund", amountUsd: 5, idempotencyKey: `${season}:${userIds.sam}:refund` },
      { userId: userIds.sam, kind: "winnings", amountUsd: 1.12, idempotencyKey: `${season}:${userIds.sam}:winnings` },
      { userId: undefined, kind: "fee", amountUsd: 0.5, idempotencyKey: `${season}:fee` },
    ]);
    expect((await t.run((ctx) => ctx.db.get("weeks", finalWeekId)))?.status).toBe("settled");
  });
});

describe("settleWeek", () => {
  beforeEach(() => {
    vi.stubEnv("WHOP_API_KEY", "apik_unit_test");
    vi.stubEnv("WHOP_ENVIRONMENT", "sandbox");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** Signs the caller in the way Convex Auth does: the subject is "userId|sessionId". */
  const as = (t: ReturnType<typeof convexTest>, userId: Id<"users">) =>
    t.withIdentity({ subject: `${userId}|session` });

  test("keeps the ledger rows when Whop refuses the transfer, and retries on the next call", async () => {
    const whopRequests: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      whopRequests.push(String(input instanceof Request ? input.url : input));
      return Response.json(
        { error: { type: "bad_request", message: "Please verify your business before transferring funds." } },
        { status: 400 },
      );
    });
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await leagueAfterWeekOne(t, FOUR_PLAYERS, {
      whopCompanyId: "biz_league",
    });

    await as(t, userIds.maya).action(api.whop.settleWeek, { leagueId });
    await as(t, userIds.maya).action(api.whop.settleWeek, { leagueId });

    const rows = await settlementRows(t);
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.whopId === undefined)).toBe(true);
    expect(whopRequests).toHaveLength(2);
    expect(whopRequests.every((url) => url.startsWith("https://sandbox-api.whop.com/"))).toBe(true);
  });

  test("stamps the transfer onto the rows it paid when Whop accepts it", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ id: "ctt_1", object: "transfer" }));
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await leagueAfterWeekOne(t, FOUR_PLAYERS, {
      whopCompanyId: "biz_league",
    });

    await as(t, userIds.maya).action(api.whop.settleWeek, { leagueId });

    const paid = (await settlementRows(t)).filter((row) => row.whopId === "ctt_1");
    expect(paid.map((row) => row.userId)).toEqual([userIds.maya, userIds.maya]);
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
