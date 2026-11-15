/**
 * Whop carries every dollar a league plays for. Sandbox only today.
 *
 * The model, as the Whop team advised:
 *
 *   - Each league is its own Whop company: a subaccount of our platform account, opened the
 *     first time a member pays. Stakes land in the league's balance, never in ours.
 *   - A buy-in is a hosted Whop checkout on the league's company. The league and the player
 *     ride along as metadata, and come back on the payment.
 *   - Whop confirms a payment by calling POST /whop. That call, once its signature is verified,
 *     is the only thing that marks a member paid; the browser closing proves nothing.
 *   - The same call names the payer's Whop user and their member record inside the league's
 *     company. Both are attached to the player, so nobody signs in to Whop separately.
 *   - Settlement pays each finisher out of the league's company, to their Whop user.
 *
 * The ledger table mirrors every movement: a buy_in row per payment, then refund, winnings and
 * fee rows at settlement that add up to exactly those buy-ins.
 *
 * Every Whop request is made from an action in this file. The app never sees a key.
 */
import { WhopClient, WhopEnvironment, WhopError } from "@whop/sdk";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  env,
  httpAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type QueryCtx,
} from "./_generated/server";
import { currentWeek as latestWeek } from "./leagues";
import { requireUser } from "./lib/auth";
import { isFinalWeek, resolveSettings, seasonOf } from "./lib/schedule";
import { computeSettlement, settlementLedgerRows, type Entrant } from "./lib/settlement";
import { leagueStandings } from "./standings";

// ---- The Whop client ----------------------------------------------------------------------------

/**
 * Sandbox and production keys look identical, so the environment is never inferred from the
 * key. Anything but an explicit WHOP_ENVIRONMENT=sandbox refuses to run rather than risk a
 * request that moves real money.
 */
function whopClient(): WhopClient {
  if (!env.WHOP_API_KEY) throw new ConvexError("WHOP_API_KEY is not set");
  if (env.WHOP_ENVIRONMENT !== "sandbox") {
    throw new ConvexError("Whop runs in the sandbox only: set WHOP_ENVIRONMENT=sandbox");
  }
  return new WhopClient({ token: env.WHOP_API_KEY, environment: WhopEnvironment.Sandbox });
}

// ---- Buy-in: checkout ---------------------------------------------------------------------------

/**
 * Starts a member's buy-in and returns the hosted checkout to open in the in-app browser.
 * Paying it is confirmed later by the webhook below; this call changes nothing about who has paid.
 */
export const createCheckout = action({
  args: { leagueId: v.id("leagues") },
  returns: v.object({ purchaseUrl: v.string() }),
  handler: async (ctx, { leagueId }) => {
    const buyIn: BuyIn = await ctx.runQuery(internal.whop.buyInFor, { leagueId });
    const whop = whopClient();
    const whopCompanyId =
      buyIn.whopCompanyId ?? (await openLeagueCompany(ctx, whop, leagueId, buyIn.leagueName));

    const checkout = await whop.checkoutConfigurations.create({
      account_id: whopCompanyId,
      variant: {
        // Whop caps this title at 30 characters, so it can't carry the league's name. The
        // checkout page shows the league's company above it anyway.
        title: "Lineup buy-in",
        billing_type: "one_time",
        initial_price: buyIn.stakeUsd,
        currency: "usd",
      },
      // Copied by Whop onto the payment, which is how the webhook knows whose buy-in it is.
      metadata: { userId: buyIn.userId, leagueId },
    });
    if (!checkout.purchase_url) throw new ConvexError("Whop returned no checkout link");
    return { purchaseUrl: checkout.purchase_url };
  },
});

type BuyIn = {
  userId: Id<"users">;
  leagueName: string;
  stakeUsd: number;
  whopCompanyId: string | null;
};

/** Who is paying, and what they owe. Refuses anyone with nothing to pay. */
export const buyInFor = internalQuery({
  args: { leagueId: v.id("leagues") },
  returns: v.object({
    userId: v.id("users"),
    leagueName: v.string(),
    stakeUsd: v.number(),
    whopCompanyId: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { leagueId }) => {
    const user = await requireUser(ctx);
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null) throw new ConvexError("League not found");
    const membership = await membershipOf(ctx, leagueId, user._id);
    if (membership === null) throw new ConvexError("Join this league before paying its buy-in");
    if (league.stakeUsd <= 0) throw new ConvexError("This league is free: there is no buy-in");
    if (membership.paid) throw new ConvexError("You have already paid this league's buy-in");
    // A stake is tied to the week it is paid in. Paid into a week already settled, it would
    // sit in the league's company with no settlement left to return it.
    const week = await currentWeek(ctx, leagueId);
    if (week.status === "settled" && resolveSettings(league).payout === "weekly") {
      throw new ConvexError("This week is settled. Buy in when the next week opens");
    }
    return {
      userId: user._id,
      leagueName: league.name,
      stakeUsd: league.stakeUsd,
      whopCompanyId: league.whopCompanyId ?? null,
    };
  },
});

/**
 * Opens the league's Whop company. Whop wants an owner email for a subaccount; leagues are run
 * by the platform, so they share ours. The external id keeps it to one company per league and
 * makes the call safe to repeat: two members paying at the same moment get the same company.
 */
async function openLeagueCompany(
  ctx: ActionCtx,
  whop: WhopClient,
  leagueId: Id<"leagues">,
  leagueName: string,
): Promise<string> {
  const platform = await whop.accounts.me();
  if (!platform.email) throw new ConvexError("The Whop platform account has no email");
  const company = await whop.accounts.create({
    email: platform.email,
    title: `Lineup · ${leagueName}`,
    external_id: `league:${leagueId}`,
    metadata: { leagueId },
  });
  await ctx.runMutation(internal.whop.saveLeagueCompany, {
    leagueId,
    whopCompanyId: company.id,
  });
  return company.id;
}

export const saveLeagueCompany = internalMutation({
  args: { leagueId: v.id("leagues"), whopCompanyId: v.string() },
  returns: v.null(),
  handler: async (ctx, { leagueId, whopCompanyId }) => {
    await ctx.db.patch("leagues", leagueId, { whopCompanyId });
    return null;
  },
});

// ---- Buy-in: confirmation (POST /whop) ----------------------------------------------------------

/**
 * Whop's webhook. Answers 503 until WHOP_WEBHOOK_SECRET is set and 401 to anything whose
 * signature does not verify, so an unverified event can never mark a buy-in as paid.
 *
 * The webhook must be created with child_resource_events on: payments belong to the league's
 * company, and a webhook on the platform account alone never hears about them.
 */
export const whopWebhook = httpAction(async (ctx, request) => {
  const secret = env.WHOP_WEBHOOK_SECRET;
  if (!secret) return new Response("WHOP_WEBHOOK_SECRET is not set", { status: 503 });

  // The signature covers the exact bytes Whop sent, so verify the raw text before parsing.
  const body = await request.text();
  let event: unknown;
  try {
    event = unwrapWebhook(body, { headers: Object.fromEntries(request.headers), key: secret });
  } catch {
    return new Response("Signature verification failed", { status: 401 });
  }

  // Whop reads the reply as JSON and files anything else in its delivery log as an error.
  const acknowledge = (outcome: "recorded" | "ignored") =>
    new Response(JSON.stringify({ outcome }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const payment = paidBuyIn(event);
  // Anything else Whop sends is acknowledged, or it would be retried for days.
  if (payment === null) return acknowledge("ignored");
  await ctx.runMutation(internal.whop.recordBuyIn, payment);
  return acknowledge("recorded");
});

export type PaidBuyIn = {
  whopPaymentId: string;
  /** Our ids as we wrote them into the checkout's metadata; still plain strings here. */
  userId: string;
  leagueId: string;
  whopUserId?: string;
  whopMemberId?: string;
};

/**
 * Reads a buy-in out of a verified webhook event, or returns null when the event is not one:
 * another event type, or a payment that did not come from a Lineup checkout.
 */
export function paidBuyIn(event: unknown): PaidBuyIn | null {
  if (!isRecord(event) || event.type !== "payment.succeeded" || !isRecord(event.data)) return null;
  const { id, metadata, user, member } = event.data;
  if (typeof id !== "string" || !isRecord(metadata)) return null;
  if (typeof metadata.userId !== "string" || typeof metadata.leagueId !== "string") return null;
  return {
    whopPaymentId: id,
    userId: metadata.userId,
    leagueId: metadata.leagueId,
    ...(isRecord(user) && typeof user.id === "string" ? { whopUserId: user.id } : {}),
    ...(isRecord(member) && typeof member.id === "string" ? { whopMemberId: member.id } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Marks the member paid, attaches their Whop identity and writes the buy_in ledger row, all in
 * one transaction. Whop delivers an event at least once, so a payment already in the ledger
 * changes nothing the second time.
 */
export const recordBuyIn = internalMutation({
  args: {
    whopPaymentId: v.string(),
    userId: v.string(),
    leagueId: v.string(),
    whopUserId: v.optional(v.string()),
    whopMemberId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, payment) => {
    const idempotencyKey = `buy_in:${payment.whopPaymentId}`;
    if (await isInLedger(ctx, idempotencyKey)) return null;

    // A payment whose metadata names nobody here was made against another deployment sharing
    // this Whop account. There is nobody to mark paid, and retrying will not change that.
    const userId = ctx.db.normalizeId("users", payment.userId);
    const leagueId = ctx.db.normalizeId("leagues", payment.leagueId);
    if (userId === null || leagueId === null) return null;
    const league = await ctx.db.get("leagues", leagueId);
    const membership = await membershipOf(ctx, leagueId, userId);
    if (league === null || membership === null) return null;

    await ctx.db.patch("memberships", membership._id, {
      paid: true,
      whopPaymentId: payment.whopPaymentId,
      // The member's record inside the league's company: their sub-account there.
      ...(payment.whopMemberId ? { whopAccountId: payment.whopMemberId } : {}),
    });
    if (payment.whopUserId) {
      await ctx.db.patch("users", userId, { whopUserId: payment.whopUserId });
    }
    const week = await currentWeek(ctx, leagueId);
    await ctx.db.insert("ledger", {
      leagueId,
      weekId: week._id,
      userId,
      kind: "buy_in",
      amountUsd: league.stakeUsd,
      whopId: payment.whopPaymentId,
      idempotencyKey,
      createdAt: Date.now(),
    });
    return null;
  },
});

// ---- Settlement ---------------------------------------------------------------------------------

/**
 * Ends the league's current week and pays it out. This is the demo control "End Week Now", so
 * any member of the league may call it.
 *
 * The ledger is written first and the money moved second. closeWeek freezes the result in one
 * transaction: refund, winnings and fee rows that add up to the buy-ins, and the week marked
 * settled. Only then is each member's transfer sent, under a key Whop will not pay twice. So
 * calling this again pays nobody again: it only retries transfers Whop has not accepted yet.
 */
export const settleWeek = action({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    await ctx.runQuery(internal.whop.requireMember, { leagueId });
    const { whopCompanyId, transfers }: Owed = await ctx.runMutation(internal.whop.closeWeek, {
      leagueId,
    });
    // A league nobody has paid into through Whop, like the seeded one, has no company to pay from.
    if (whopCompanyId === null || transfers.length === 0) return null;

    const whop = whopClient();
    for (const transfer of transfers) {
      try {
        const sent = await whop.transfers.create({
          type: "balance",
          origin_id: whopCompanyId,
          destination_id: transfer.whopUserId,
          amount: transfer.amountUsd,
          currency: "usd",
          idempotence_key: transfer.idempotenceKey,
          notes: "Lineup payout",
        });
        await ctx.runMutation(internal.whop.recordTransfer, {
          ledgerIds: transfer.ledgerIds,
          whopTransferId: sent.id,
        });
      } catch (error) {
        // Whop refuses transfers out of a company that has not passed identity verification,
        // which no sandbox league has. The ledger rows stand, the app shows payouts from
        // them, and the next call retries under the same key.
        if (!(error instanceof WhopError)) throw error;
        console.warn(`Whop did not accept transfer ${transfer.idempotenceKey}: ${error.message}`);
      }
    }
    return null;
  },
});

export const requireMember = internalQuery({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const user = await requireUser(ctx);
    if ((await membershipOf(ctx, leagueId, user._id)) === null) {
      throw new ConvexError("Only a member can end this league's week");
    }
    return null;
  },
});

/** One member's payout as a single Whop transfer: their refund and winnings rows together. */
const owedTransfer = v.object({
  ledgerIds: v.array(v.id("ledger")),
  whopUserId: v.string(),
  amountUsd: v.number(),
  idempotenceKey: v.string(),
});
const owed = v.object({
  whopCompanyId: v.union(v.string(), v.null()),
  transfers: v.array(owedTransfer),
});
type Owed = typeof owed.type;

/**
 * Settles the league's current week in the ledger and returns the transfers still to send.
 *
 * A "weekly" league settles every week on that week's standings. A "season" league holds every
 * stake until the season's final week: earlier weeks only close, and the final one settles once
 * on season totals. Either way the maths is computeSettlement in lib/settlement.ts.
 *
 * Runs as one transaction and only acts on an open week, so two calls at once cannot both
 * write rows. On a week already settled it changes nothing and reports what is still unsent.
 */
export const closeWeek = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: owed,
  handler: async (ctx, { leagueId }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null) throw new ConvexError("League not found");
    const week = await currentWeek(ctx, leagueId);
    const { payout, seasonWeeks } = resolveSettings(league);
    const bySeason = payout === "season";
    // What one settlement covers. It prefixes the ledger keys and is the transfer's idempotence
    // key together with the member: "{weekId}:{userId}" or "{leagueId}:season:{userId}".
    // One season per league today; a second would need its number in here.
    const scope = bySeason ? `${leagueId}:season` : week._id;

    if (week.status === "open") {
      if (!bySeason || isFinalWeek(week.number, seasonWeeks)) {
        const weeks = bySeason ? await weeksOfSeason(ctx, week, seasonWeeks) : [week];
        const entrants = await entrantsOver(ctx, leagueId, weeks);
        const settlement = computeSettlement(league.stakeUsd, entrants);
        for (const row of settlementLedgerRows(scope, settlement)) {
          if (await isInLedger(ctx, row.idempotencyKey)) continue;
          await ctx.db.insert("ledger", {
            leagueId,
            weekId: week._id,
            ...row,
            createdAt: Date.now(),
          });
        }
      }
      await ctx.db.patch("weeks", week._id, { status: "settled" });
      // Next week's draft learns from this one. It runs on its own, so it can't hold up or fail
      // the settlement, and only the call that closes the week schedules it.
      await ctx.scheduler.runAfter(0, internal.lineup.rememberOutcomes, {
        leagueId,
        weekStart: week.startsAt,
      });
    }

    return {
      whopCompanyId: league.whopCompanyId ?? null,
      transfers: await unsentTransfers(ctx, leagueId, scope),
    };
  },
});

/** Stamps the Whop transfer onto the ledger rows it paid, which is what marks them as sent. */
export const recordTransfer = internalMutation({
  args: { ledgerIds: v.array(v.id("ledger")), whopTransferId: v.string() },
  returns: v.null(),
  handler: async (ctx, { ledgerIds, whopTransferId }) => {
    for (const ledgerId of ledgerIds) {
      await ctx.db.patch("ledger", ledgerId, { whopId: whopTransferId });
    }
    return null;
  },
});

/**
 * Every member's standing over the weeks being settled, as the settlement maths takes it.
 *
 * Paid means the ledger holds their buy-in for one of these weeks. The ledger decides, not
 * memberships.paid, so a stake can only ever be returned by the settlement it was paid into.
 *
 * Points and finishers come from the standings table (standings.ts), the one place a week is
 * added up, so the pot is split on the numbers the League tab shows. `atSettlement` counts the
 * matchup bonus of the week being closed, which the table only shows once that week is settled.
 */
async function entrantsOver(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  weeks: Doc<"weeks">[],
): Promise<Entrant<Id<"users">>[]> {
  const weekIds = new Set(weeks.map((week) => week._id));
  const boughtIn = new Set(
    (await leagueLedger(ctx, leagueId))
      .filter((row) => row.kind === "buy_in" && weekIds.has(row.weekId))
      .map((row) => row.userId),
  );
  const standings = (
    await Promise.all(
      weeks.map((week) => leagueStandings(ctx, leagueId, week._id, { atSettlement: true })),
    )
  ).flat();
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .take(MAX_MEMBERS);

  return memberships.map(({ userId }) => {
    const mine = standings.filter((standing) => standing.userId === userId);
    const weeksCleared = mine.filter((standing) => standing.finisher).length;
    return {
      userId,
      paid: boughtIn.has(userId),
      // In one week: cleared all five slots. Over a season: did so in at least half its weeks.
      finished: weeksCleared > 0 && weeksCleared * 2 >= weeks.length,
      points: mine.reduce((sum, standing) => sum + standing.points, 0),
    };
  });
}

/** The weeks of the season `week` belongs to that the league has played, `week` included. */
async function weeksOfSeason(
  ctx: QueryCtx,
  week: Doc<"weeks">,
  seasonWeeks: number,
): Promise<Doc<"weeks">[]> {
  const { firstWeek, lastWeek } = seasonOf(week.number, seasonWeeks);
  const weeks = await leagueWeeks(ctx, week.leagueId);
  return weeks.filter((other) => other.number >= firstWeek && other.number <= lastWeek);
}

/**
 * The transfers a settlement still owes: per member, their refund and winnings rows that carry
 * no Whop id yet. Members who never paid through Whop (seeded players) have no Whop user to
 * send to; their rows stay in the ledger as the record of what they are owed.
 */
async function unsentTransfers(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  scope: string,
): Promise<Owed["transfers"]> {
  const rowsByUser = new Map<Id<"users">, Doc<"ledger">[]>();
  for (const row of await leagueLedger(ctx, leagueId)) {
    if (row.userId === undefined || row.whopId !== undefined) continue;
    if (!row.idempotencyKey.startsWith(`${scope}:`)) continue;
    rowsByUser.set(row.userId, [...(rowsByUser.get(row.userId) ?? []), row]);
  }

  const transfers: Owed["transfers"] = [];
  for (const [userId, rows] of rowsByUser) {
    const user = await ctx.db.get("users", userId);
    if (!user?.whopUserId) continue;
    const cents = rows.reduce((sum, row) => sum + Math.round(row.amountUsd * 100), 0);
    transfers.push({
      ledgerIds: rows.map((row) => row._id),
      whopUserId: user.whopUserId,
      amountUsd: cents / 100,
      idempotenceKey: `${scope}:${userId}`,
    });
  }
  return transfers;
}

// ---- Shared reads -------------------------------------------------------------------------------

async function membershipOf(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  userId: Id<"users">,
): Promise<Doc<"memberships"> | null> {
  return await ctx.db
    .query("memberships")
    .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", userId))
    .first();
}

// Bounds on reads. Each is far above what a league of friends produces; they exist so that no
// query here is unbounded.
const MAX_MEMBERS = 200;
/** One weeks row per calendar week: ten years of them. */
const MAX_WEEKS = 520;
/** A week adds at most a buy-in, a refund and a winnings row per member, and one fee row. */
const MAX_LEDGER_ROWS = 8000;

async function leagueWeeks(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"weeks">[]> {
  return await ctx.db
    .query("weeks")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .take(MAX_WEEKS);
}

/** The week the league is playing now: its latest row. Every league has one from the day it is created. */
async function currentWeek(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"weeks">> {
  const week = await latestWeek(ctx, leagueId);
  if (week === null) throw new ConvexError("This league has no week to play in yet");
  return week;
}

async function leagueLedger(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"ledger">[]> {
  return await ctx.db
    .query("ledger")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .take(MAX_LEDGER_ROWS);
}

/** Every ledger row carries a key naming the one movement it records; this is the duplicate check. */
async function isInLedger(ctx: QueryCtx, idempotencyKey: string): Promise<boolean> {
  const row = await ctx.db
    .query("ledger")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
    .first();
  return row !== null;
}
