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
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { currentWeek as latestWeek, ensureCurrentWeek, membersInJoinOrder, membershipOf, paidInto } from "./leagues";
import { requireUser } from "./lib/auth";
import { isFinalWeek, resolveSettings, seasonOf } from "./lib/schedule";
import { weekStartOf } from "./lib/week";
import { computeSettlement, settlementLedgerRows, type Entrant } from "./lib/settlement";
import { computeVersusSettlement } from "./lib/versusSettlement";
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
    const week = await currentWeek(ctx, leagueId);
    // The ledger says who has paid, here as for the Pay banner and at settlement.
    if ((await paidInto(ctx, league, week))(user._id)) {
      throw new ConvexError("You have already paid this league's buy-in");
    }
    // A stake is tied to the week it is paid in. Paid into a week already settled, it would
    // sit in the league's company with no settlement left to return it.
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
 * settled. Only then is the money moved on Whop, each movement under a key Whop will not pay
 * twice. So calling this again pays nobody again: it only retries what Whop has not accepted yet.
 *
 * A stake goes back the way it came, as a refund of the member's buy-in payment. Winnings are
 * new money to the member, so they go as a transfer out of the league's company.
 */
export const settleWeek = action({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    await ctx.runQuery(internal.whop.requireMember, { leagueId });
    const owed: Owed = await ctx.runMutation(internal.whop.closeWeek, { leagueId });
    // A settled week carries the matchup bonus, so the leaderboards rebuild the league's stored rows.
    await ctx.scheduler.runAfter(0, internal.leaderboards.rebuild, { leagueId });
    await payOnWhop(ctx, owed);
    return null;
  },
});

/**
 * The week's end when nobody presses End Week Now. The hourly sweep in leagues.ts calls this for
 * each league whose week has run out, and it is safe to call at any time, any number of times.
 *
 * rollWeek does the work in one transaction, so a league is never left between weeks: once the
 * calendar has left the league's latest week it settles that week, unless End Week Now already
 * has, and opens the next with its matchups. The money moves afterwards, as in settleWeek. What
 * Whop refuses stays in the ledger as unsent rows, and retryPayouts sends those again later.
 */
export const endWeek = internalAction({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const owed: Owed | null = await ctx.runMutation(internal.whop.rollWeek, { leagueId });
    if (owed === null) return null;
    await ctx.scheduler.runAfter(0, internal.leaderboards.rebuild, { leagueId });
    await payOnWhop(ctx, owed);
    return null;
  },
});

/**
 * Sends again what an earlier week's settlement still owes on Whop. settleWeek only reaches the
 * league's current week, so this is the way back to a week the league has moved on from:
 *
 *   npx convex run whop:retryPayouts '{"leagueId": "…", "weekId": "…"}'
 *
 * In a season league any week of a season names that season's settlement. A week that was left
 * open is settled first, as End Week Now would have settled it.
 */
export const retryPayouts = internalAction({
  args: { leagueId: v.id("leagues"), weekId: v.id("weeks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owed: Owed = await ctx.runMutation(internal.whop.closeWeek, args);
    await payOnWhop(ctx, owed);
    return null;
  },
});

/**
 * Moves on Whop what a settlement still owes and stamps the ledger rows it paid. A refusal from
 * Whop is logged and leaves its rows unsent for a later call; it never fails the caller.
 */
async function payOnWhop(ctx: ActionCtx, { whopCompanyId, refunds, transfers }: Owed): Promise<void> {
  // A league nobody has paid into through Whop, like the seeded one, has nothing to move there.
  if (refunds.length === 0 && transfers.length === 0) return;

  const whop = whopClient();
  /** Moves one payout on Whop and stamps its ledger rows. A refusal leaves them for the next call. */
  const pay = async (key: string, ledgerIds: Id<"ledger">[], move: () => Promise<string>) => {
    try {
      const whopId = await move();
      await ctx.runMutation(internal.whop.recordPaid, { ledgerIds, whopId });
    } catch (error) {
      if (!(error instanceof WhopError)) throw error;
      console.warn(`Whop did not accept ${key}: ${error.message}`);
    }
  };

  for (const refund of refunds) {
    await pay(refund.idempotencyKey, [refund.ledgerId], async () => {
      // An amount that covers all that is left to refund refunds the rest of the payment.
      await whop.payments.refund(
        { id: refund.whopPaymentId, partial_amount: refund.amountUsd },
        { idempotencyKey: refund.idempotencyKey },
      );
      return refund.whopPaymentId;
    });
  }
  // Whop refuses transfers out of a company that has not passed identity verification, which
  // no sandbox league has. Those rows stand, and the app shows the payout from the ledger.
  if (whopCompanyId === null) return;
  for (const transfer of transfers) {
    await pay(transfer.idempotenceKey, transfer.ledgerIds, async () => {
      const sent = await whop.transfers.create({
        type: "balance",
        origin_id: whopCompanyId,
        destination_id: transfer.whopUserId,
        amount: transfer.amountUsd,
        currency: "usd",
        idempotence_key: transfer.idempotenceKey,
        notes: "Lineup payout",
      });
      return sent.id;
    });
  }
}

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

/** A member's stake, to go back as a refund of the Whop payment that bought them in. */
const owedRefund = v.object({
  ledgerId: v.id("ledger"),
  whopPaymentId: v.string(),
  amountUsd: v.number(),
  idempotencyKey: v.string(),
});
/** The rest of a member's payout as a single Whop transfer. */
const owedTransfer = v.object({
  ledgerIds: v.array(v.id("ledger")),
  whopUserId: v.string(),
  amountUsd: v.number(),
  idempotenceKey: v.string(),
});
const owed = v.object({
  whopCompanyId: v.union(v.string(), v.null()),
  refunds: v.array(owedRefund),
  transfers: v.array(owedTransfer),
});
type Owed = typeof owed.type;

/**
 * Settles a week in the ledger and returns what its settlement still owes on Whop: the league's
 * current week, or the earlier one named.
 *
 * Runs as one transaction and only acts on an open week, so two calls at once cannot both
 * write rows. On a week already settled it changes nothing and reports what is still unsent.
 */
export const closeWeek = internalMutation({
  args: { leagueId: v.id("leagues"), weekId: v.optional(v.id("weeks")) },
  returns: owed,
  handler: async (ctx, { leagueId, weekId }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null) throw new ConvexError("League not found");
    const week = weekId === undefined ? await currentWeek(ctx, leagueId) : await ctx.db.get("weeks", weekId);
    if (week === null || week.leagueId !== leagueId) throw new ConvexError("That week is not this league's");
    return await settleInLedger(ctx, league, week);
  },
});

/**
 * Closes the league's latest week once the calendar has left it, and opens the next. Returns
 * what the week it closed owes on Whop, or null when it closed none.
 */
export const rollWeek = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.union(owed, v.null()),
  handler: async (ctx, { leagueId }) => {
    const league = await ctx.db.get("leagues", leagueId);
    const week = await latestWeek(ctx, leagueId);
    // The test ensureCurrentWeek makes. While it holds the league is in its current week, and
    // that includes a week End Week Now closed early: its next week still opens on Monday.
    if (league === null || week === null || week.startsAt === weekStartOf(Date.now())) return null;

    const wasOpen = week.status === "open";
    const unsent = await settleInLedger(ctx, league, week);
    // A versus is a single week: the game ends here, and a rematch is a new league (versus.ts).
    if (league.mode !== "versus") await ensureCurrentWeek(ctx, leagueId);
    // A week settled before this call was paid, or tried, by the call that settled it.
    return wasOpen ? unsent : null;
  },
});

/**
 * Settles `week` in the ledger, if it is still open, and returns what its settlement still owes
 * on Whop.
 *
 * A "weekly" league settles every week on that week's standings. A "season" league holds every
 * stake until the season's final week: earlier weeks only close, and the final one settles once
 * on season totals. Either way the maths is computeSettlement in lib/settlement.ts.
 */
async function settleInLedger(ctx: MutationCtx, league: Doc<"leagues">, week: Doc<"weeks">): Promise<Owed> {
  const leagueId = league._id;
  const { payout, seasonWeeks } = resolveSettings(league);
  const bySeason = payout === "season";
  // What one settlement covers. It prefixes the ledger keys and is the transfer's idempotence
  // key together with the member: "{weekId}:{userId}" or "{leagueId}:season:{userId}". A league
  // plays on after its first season, and each later season settles under its own number:
  // "{leagueId}:season-2:{userId}".
  let scope: string = week._id;
  if (bySeason) {
    const season = seasonOf(week.number, seasonWeeks).number;
    scope = season === 1 ? `${leagueId}:season` : `${leagueId}:season-${season}`;
  }

  // The weeks one settlement covers: the buy-ins it returns were paid in these.
  const weeks = bySeason ? await weeksOfSeason(ctx, week, seasonWeeks) : [week];

  if (week.status === "open") {
    if (!bySeason || isFinalWeek(week.number, seasonWeeks)) {
      const entrants = await entrantsOver(ctx, leagueId, weeks);
      // A 1v1 versus pays the higher score; a league pays its finishers (convex/versus.ts).
      const settle = league.mode === "versus" ? computeVersusSettlement : computeSettlement;
      const settlement = settle(league.stakeUsd, entrants);
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
    // A week closed early with End Week Now is over at once. Its end time is what the League
    // tab counts down to and where the week's challenge window stops, so both follow.
    await ctx.db.patch("weeks", week._id, {
      status: "settled",
      endsAt: Math.min(week.endsAt, Date.now()),
    });
    // Next week's draft learns from this one. It runs on its own, so it can't hold up or fail
    // the settlement, and only the call that closes the week schedules it.
    await ctx.scheduler.runAfter(0, internal.lineup.rememberOutcomes, {
      leagueId,
      weekStart: week.startsAt,
    });
    // The week's drops end with it, so no drop banner stays on Roster after the week is over.
    // Scheduled for the same reasons as the call above.
    await ctx.scheduler.runAfter(0, internal.drops.closeForWeek, {
      leagueId,
      weekStart: week.startsAt,
    });
  }

  return {
    whopCompanyId: league.whopCompanyId ?? null,
    ...(await unpaidOnWhop(ctx, leagueId, scope, weeks)),
  };
}

/**
 * Stamps ledger rows with the Whop object that paid them, which is what marks them as paid: the
 * transfer, or for a returned stake the buy-in payment that was refunded.
 */
export const recordPaid = internalMutation({
  args: { ledgerIds: v.array(v.id("ledger")), whopId: v.string() },
  returns: v.null(),
  handler: async (ctx, { ledgerIds, whopId }) => {
    for (const ledgerId of ledgerIds) {
      await ctx.db.patch("ledger", ledgerId, { whopId });
    }
    return null;
  },
});

/**
 * Every member's standing over the weeks being settled, as the settlement maths takes it.
 *
 * Everything comes from the standings table (standings.ts), the one place a week is added up,
 * so the pot is split on the numbers the League tab shows. Paid there means the ledger holds the
 * member's buy-in for the settlement the week belongs to (paidInto in leagues.ts), not that
 * memberships.paid is set, so a stake can only be returned by the settlement it was paid into.
 * `atSettlement` counts the matchup bonus of the week being closed, which the table only shows
 * once that week is settled.
 */
export async function entrantsOver(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  weeks: Doc<"weeks">[],
): Promise<Entrant<Id<"users">>[]> {
  const standings = (
    await Promise.all(
      weeks.map((week) => leagueStandings(ctx, leagueId, week._id, { atSettlement: true })),
    )
  ).flat();
  const memberships = await membersInJoinOrder(ctx, leagueId);

  return memberships.map(({ userId }) => {
    const mine = standings.filter((standing) => standing.userId === userId);
    const weeksCleared = mine.filter((standing) => standing.finisher).length;
    return {
      userId,
      paid: mine.some((standing) => standing.paid),
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
 * What a settlement still owes on Whop: its refund and winnings rows that carry no Whop id yet.
 *
 * A refund row whose member bought in with a Whop payment is paid by refunding that payment,
 * which Whop allows whatever the state of the league's company. Everything else a member is
 * owed goes in one transfer to their Whop user. Members who never paid through Whop (seeded
 * players) have neither; their rows stay in the ledger as the record of what they are owed.
 */
async function unpaidOnWhop(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  scope: string,
  weeks: Doc<"weeks">[],
): Promise<Pick<Owed, "refunds" | "transfers">> {
  const ledger = await leagueLedger(ctx, leagueId);
  const weekIds = new Set(weeks.map((week) => week._id));
  const buyInPayment = new Map<Id<"users">, string>();
  for (const row of ledger) {
    if (row.kind !== "buy_in" || !weekIds.has(row.weekId)) continue;
    if (row.userId !== undefined && row.whopId !== undefined) buyInPayment.set(row.userId, row.whopId);
  }

  const refunds: Owed["refunds"] = [];
  const byTransfer = new Map<Id<"users">, Doc<"ledger">[]>();
  for (const row of ledger) {
    if (row.userId === undefined || row.whopId !== undefined) continue;
    if (!row.idempotencyKey.startsWith(`${scope}:`)) continue;
    const whopPaymentId = buyInPayment.get(row.userId);
    if (row.kind === "refund" && whopPaymentId !== undefined) {
      refunds.push({
        ledgerId: row._id,
        whopPaymentId,
        amountUsd: row.amountUsd,
        idempotencyKey: row.idempotencyKey,
      });
    } else {
      byTransfer.set(row.userId, [...(byTransfer.get(row.userId) ?? []), row]);
    }
  }

  const transfers: Owed["transfers"] = [];
  for (const [userId, rows] of byTransfer) {
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
  return { refunds, transfers };
}

// ---- Shared reads -------------------------------------------------------------------------------

// Bounds on reads. Each is far above what a league of friends produces; they exist so that no
// query here is unbounded.
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
