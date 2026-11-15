/**
 * Push: a Lineup notification delivered while the app is closed.
 *
 * While the app runs it raises each notification itself, from its reactive queries
 * (lib/notifications). When it is closed the backend sends the very same object through Expo's
 * push service. Both build it with lib/notificationContent.ts, so the two copies carry the same
 * id and words, and a phone that receives both shows one.
 *
 *   registerToken  the app hands over this device's Expo push token
 *   settings       what the notification settings screen shows
 *   setEnabled     the Push switch
 *   send           other modules schedule it beside keiki.send, with the notification already built
 *
 * One alert per event: a player who plays by text is told by the text keiki.send sends for the
 * same event, so their phone is not pushed as well (see shouldPush).
 *
 * Like a phone number in keiki.ts, a token belongs to the device's own account and not to the
 * seeded player the device is acting as under Switch Player. Expo Go and simulators never get a
 * token, and for them send does nothing at all.
 */
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { requireSignedInUser } from "./lib/auth";

/** Expo holds the APNs key and asks for no credential of ours, so there is no secret in this module. */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** The most messages Expo takes in one request. */
const EXPO_BATCH = 100;
/** What getExpoPushTokenAsync returns: "ExponentPushToken[…]", or "ExpoPushToken[…]" from newer clients. */
const EXPO_PUSH_TOKEN = /^Expo(nent)?PushToken\[[^\]\s]+\]$/;
/** A league's roster and the devices acting as one player are far smaller; this only bounds the reads. */
const MAX_ROWS = 200;

// ─── The one-alert rule ──────────────────────────────────────────────────────────────────────

/** Whether keiki.send texts this account: it opted in and has a number (keiki.phonesOf). */
export function textsOn(account: Pick<Doc<"users">, "keikiOptIn" | "phone">): boolean {
  return account.keikiOptIn === true && Boolean(account.phone);
}

/**
 * The one-alert rule: an event reaches a phone as a text or as a push, never both. An account
 * is pushed only when its device gave us a token, the player has not turned Push off, and texts
 * are off for it. With texts on, the text is the alert and the app updates silently in place.
 */
export function shouldPush(
  account: Pick<Doc<"users">, "pushEnabled" | "keikiOptIn" | "phone">,
  hasToken: boolean,
): boolean {
  return hasToken && account.pushEnabled !== false && !textsOn(account);
}

// ─── This device: its token and its switch ───────────────────────────────────────────────────

/**
 * The app calls this on every launch once iOS has granted notifications, so registering the
 * token an account already holds writes nothing.
 *
 * A token names one installation of the app, and an installation is signed in to one account
 * at a time. When a token turns up under a new account (the app was reinstalled and signed in
 * afresh), the old account gives it up, as a phone number does in keiki.linkPhone. Otherwise a
 * league-wide push would ring that phone once for each account.
 */
export const registerToken = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const account = await requireSignedInUser(ctx);
    // What is stored here is later handed to Expo as an address, so only an address goes in.
    if (!EXPO_PUSH_TOKEN.test(token)) throw new ConvexError("That is not an Expo push token");

    const holders = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .take(MAX_ROWS);
    for (const holder of holders) {
      if (holder.userId !== account._id) await ctx.db.delete("pushTokens", holder._id);
    }

    const mine = await tokenOf(ctx, account._id);
    if (mine === null) await ctx.db.insert("pushTokens", { userId: account._id, token, updatedAt: Date.now() });
    else if (mine.token !== token) await ctx.db.patch("pushTokens", mine._id, { token, updatedAt: Date.now() });
    return null;
  },
});

/**
 * What the notification settings screen shows for this device. textsOn is there so the screen
 * can say why a player with Push on gets no pushes: their texts are the alerts. hasToken is
 * false in Expo Go, on a simulator, and until iOS grants permission.
 */
export const settings = query({
  args: {},
  returns: v.object({ pushOn: v.boolean(), textsOn: v.boolean(), hasToken: v.boolean() }),
  handler: async (ctx) => {
    const account = await requireSignedInUser(ctx);
    return {
      pushOn: account.pushEnabled !== false,
      textsOn: textsOn(account),
      hasToken: (await tokenOf(ctx, account._id)) !== null,
    };
  },
});

/** The Push switch. Off keeps the token, so turning it back on needs nothing from the phone. */
export const setEnabled = mutation({
  args: { enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { enabled }) => {
    const account = await requireSignedInUser(ctx);
    await ctx.db.patch("users", account._id, { pushEnabled: enabled });
    return null;
  },
});

/** An account's token row, or null. registerToken keeps every account to one. */
async function tokenOf(ctx: QueryCtx, accountId: Id<"users">): Promise<Doc<"pushTokens"> | null> {
  return await ctx.db
    .query("pushTokens")
    .withIndex("by_user", (q) => q.eq("userId", accountId))
    .first();
}

// ─── Outbound: pushes from the rest of the backend ───────────────────────────────────────────

/**
 * A LineupNotification (lib/notificationContent.ts) as it crosses the scheduler. kind and
 * category are plain strings because that file owns the lists: a kind added there must not be
 * refused here.
 */
const notification = v.object({
  id: v.string(),
  kind: v.string(),
  title: v.string(),
  body: v.string(),
  url: v.string(),
  category: v.optional(v.string()),
});

/**
 * Pushes one notification to one player or to every member of a league. Other modules schedule
 * this beside the text for the same event
 * (`ctx.scheduler.runAfter(0, internal.push.send, { leagueId, notification })`) and never
 * await it, so a slow or failing push cannot undo the mutation that decided it.
 *
 * data carries what the app needs to treat the push as its own local copy: the id it drops a
 * duplicate by, and the url a tap opens.
 */
export const send = internalAction({
  args: {
    userId: v.optional(v.id("users")),
    leagueId: v.optional(v.id("leagues")),
    notification,
  },
  returns: v.null(),
  handler: async (ctx, { userId, leagueId, notification }) => {
    const tokens: string[] = await ctx.runQuery(internal.push.tokensOf, { userId, leagueId });
    // Nobody to ring: every recipient plays by text, turned Push off, or runs Expo Go. Most
    // sends end here, without a request.
    if (tokens.length === 0) return null;

    const { id, kind, title, body, url, category } = notification;
    let accepted = 0;
    const unregistered: string[] = [];
    for (let start = 0; start < tokens.length; start += EXPO_BATCH) {
      const batch = tokens.slice(start, start + EXPO_BATCH);
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(
          batch.map((to) => ({ to, title, body, sound: "default", data: { id, kind, url }, categoryId: category })),
        ),
      });
      // A refused batch has no tickets: its tokens are kept and count as failed below.
      const tickets = readTickets(batch, response.ok ? await response.json() : null);
      accepted += tickets.accepted;
      unregistered.push(...tickets.unregistered);
    }
    if (unregistered.length > 0) await ctx.runMutation(internal.push.forgetTokens, { tokens: unregistered });
    // Counts only: a token is a device's address, and addresses stay out of the logs.
    const failed = tokens.length - accepted - unregistered.length;
    console.log(`Push ${kind}: ${accepted} sent, ${unregistered.length} unregistered, ${failed} failed`);
    return null;
  },
});

/**
 * Reads Expo's answer to one batch: a ticket per message, in the order the messages were sent.
 * unregistered are the tokens Expo says no longer name a device (the app was deleted), which
 * send forgets so the next event does not try them again. A reply that is not tickets yields
 * none of either, so an answer we cannot read never deletes a token.
 */
export function readTickets(tokens: readonly string[], reply: unknown): { accepted: number; unregistered: string[] } {
  const tickets =
    typeof reply === "object" && reply !== null && "data" in reply && Array.isArray(reply.data) ? reply.data : [];
  let accepted = 0;
  const unregistered: string[] = [];
  tokens.forEach((token, index) => {
    if (tickets[index]?.status === "ok") accepted += 1;
    else if (tickets[index]?.details?.error === "DeviceNotRegistered") unregistered.push(token);
  });
  return { accepted, unregistered };
}

/** Expo reported these tokens as no longer registered. */
export const forgetTokens = internalMutation({
  args: { tokens: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { tokens }) => {
    for (const token of tokens) {
      const rows = await ctx.db
        .query("pushTokens")
        .withIndex("by_token", (q) => q.eq("token", token))
        .take(MAX_ROWS);
      for (const row of rows) await ctx.db.delete("pushTokens", row._id);
    }
    return null;
  },
});

/** The tokens behind a send: one player's or a league's members', after the one-alert rule. */
export const tokensOf = internalQuery({
  args: { userId: v.optional(v.id("users")), leagueId: v.optional(v.id("leagues")) },
  returns: v.array(v.string()),
  handler: async (ctx, { userId, leagueId }) => {
    const players = new Set<Id<"users">>();
    if (userId !== undefined) players.add(userId);
    if (leagueId !== undefined) {
      const members = await ctx.db
        .query("memberships")
        .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
        .take(MAX_ROWS);
      for (const member of members) players.add(member.userId);
    }

    // A set: one device can stand for two of these players, its own account and the one it acts as.
    const tokens = new Set<string>();
    for (const playerId of players) {
      for (const token of await tokensFor(ctx, playerId)) tokens.add(token);
    }
    return [...tokens];
  },
});

/**
 * Whether send would reach at least one device for this player. A sender asks before doing
 * work whose only result is a push nobody would get.
 */
export async function reachableByPush(ctx: QueryCtx, userId: Id<"users">): Promise<boolean> {
  return (await tokensFor(ctx, userId)).length > 0;
}

/**
 * The tokens an event for this player rings: their own account's and, under Switch Player, that
 * of any device acting as them, as keiki.phonesOf does for texts; otherwise the demo phone
 * would never get the push. The one-alert rule is asked of each account on its own, because a
 * text and a push both land on a device, not on a player.
 */
async function tokensFor(ctx: QueryCtx, playerId: Id<"users">): Promise<string[]> {
  const own = await ctx.db.get("users", playerId);
  const devices = await ctx.db
    .query("users")
    .withIndex("by_demoActAs", (q) => q.eq("demoActAs", playerId))
    .take(MAX_ROWS);

  const tokens: string[] = [];
  for (const account of own === null ? devices : [own, ...devices]) {
    const row = await tokenOf(ctx, account._id);
    if (row !== null && shouldPush(account, true)) tokens.push(row.token);
  }
  return tokens;
}
