// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { Webhook } from "standardwebhooks";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
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
