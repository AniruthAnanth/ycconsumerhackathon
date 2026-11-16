/**
 * The league group chat: one thread per league with every member and Sunny, the league's
 * commissioner. Members post with send; Sunny posts on league events through postEvent (no model
 * call) and answers when addressed, through YCCO-8's keiki.groupReply with the thread as context.
 */
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { makeFunctionReference } from "convex/server";

import { internalAction, internalMutation, internalQuery, type MutationCtx, mutation, query, type QueryCtx } from "./_generated/server";
import { membershipOf } from "./leagues";
import { requireUser } from "./lib/auth";

const THREAD_SIZE = 200;
/** How much of the thread Sunny reads before answering. */
const CONTEXT_SIZE = 20;

type ThreadLine = { author: string; fromSunny: boolean; text: string };
/**
 * YCCO-8's Sunny entry point in keiki.ts, referenced by name so this module does not wait on its
 * types; if it is not deployed yet the call fails and Sunny just stops typing.
 */
const groupReply = makeFunctionReference<
  "action",
  { leagueId: Id<"leagues">; askerId: Id<"users">; messages: ThreadLine[] },
  { text: string }
>("keiki:groupReply");
const MAX_TEXT = 2000;
export const REACTIONS = ["👍", "❤️", "😂", "🔥", "💪", "👏"] as const;

/** A message addresses Sunny when it names Sunny or asks a question. */
export function addressesSunny(text: string): boolean {
  return /@sunny\b/i.test(text) || text.trim().endsWith("?");
}

async function requireMember(ctx: QueryCtx, leagueId: Id<"leagues">) {
  const me = await requireUser(ctx);
  if ((await membershipOf(ctx, leagueId, me._id)) === null) throw new ConvexError("You are not in this league");
  return me;
}

async function recent(ctx: QueryCtx, leagueId: Id<"leagues">, size: number) {
  const newestFirst = await ctx.db
    .query("leagueMessages")
    .withIndex("by_league_created", (q) => q.eq("leagueId", leagueId))
    .order("desc")
    .take(size);
  return newestFirst.reverse();
}

const authorV = v.union(
  v.object({ kind: v.literal("member"), userId: v.id("users"), name: v.string(), avatarUrl: v.optional(v.string()) }),
  v.object({ kind: v.literal("sunny") }),
);

export const list = query({
  args: { leagueId: v.id("leagues") },
  returns: v.object({
    messages: v.array(
      v.object({
        _id: v.id("leagueMessages"),
        author: authorV,
        mine: v.boolean(),
        text: v.string(),
        createdAt: v.number(),
        replyTo: v.optional(v.object({ _id: v.id("leagueMessages"), authorName: v.string(), text: v.string() })),
        reactions: v.array(v.object({ emoji: v.string(), count: v.number(), mine: v.boolean() })),
      }),
    ),
    sunnyTyping: v.boolean(),
  }),
  handler: async (ctx, { leagueId }) => {
    const me = await requireMember(ctx, leagueId);
    const messages = await recent(ctx, leagueId, THREAD_SIZE);
    const users = new Map<Id<"users">, Doc<"users"> | null>();
    const userOf = async (userId: Id<"users">) => {
      if (!users.has(userId)) users.set(userId, await ctx.db.get("users", userId));
      return users.get(userId) ?? null;
    };
    const nameOf = async (message: Doc<"leagueMessages">) =>
      message.userId ? ((await userOf(message.userId))?.name ?? "A player") : "Sunny";

    const out = [];
    for (const message of messages) {
      const user = message.userId ? await userOf(message.userId) : null;
      const quoted = message.replyToId ? await ctx.db.get("leagueMessages", message.replyToId) : null;
      const rows = await ctx.db
        .query("leagueMessageReactions")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .take(100);
      const counts = new Map<string, { count: number; mine: boolean }>();
      for (const row of rows) {
        const entry = counts.get(row.emoji) ?? { count: 0, mine: false };
        counts.set(row.emoji, { count: entry.count + 1, mine: entry.mine || row.userId === me._id });
      }
      out.push({
        _id: message._id,
        author: message.userId
          ? { kind: "member" as const, userId: message.userId, name: user?.name ?? "A player", ...(user?.image ? { avatarUrl: user.image } : {}) }
          : { kind: "sunny" as const },
        mine: message.userId === me._id,
        text: message.text,
        createdAt: message.createdAt,
        ...(quoted ? { replyTo: { _id: quoted._id, authorName: await nameOf(quoted), text: quoted.text.slice(0, 140) } } : {}),
        reactions: [...counts].map(([emoji, { count, mine }]) => ({ emoji, count, mine })),
      });
    }
    const sunny = await ctx.db.query("leagueChatSunny").withIndex("by_league", (q) => q.eq("leagueId", leagueId)).first();
    return { messages: out, sunnyTyping: sunny?.typing ?? false };
  },
});

export const send = mutation({
  args: { leagueId: v.id("leagues"), text: v.string(), replyToId: v.optional(v.id("leagueMessages")) },
  returns: v.id("leagueMessages"),
  handler: async (ctx, { leagueId, text, replyToId }) => {
    const me = await requireMember(ctx, leagueId);
    const body = text.trim().slice(0, MAX_TEXT);
    if (!body) throw new ConvexError("Type a message first");
    if (replyToId) {
      const quoted = await ctx.db.get("leagueMessages", replyToId);
      if (!quoted || quoted.leagueId !== leagueId) throw new ConvexError("That message is not in this chat");
    }
    const now = Date.now();
    const id = await ctx.db.insert("leagueMessages", { leagueId, userId: me._id, text: body, replyToId, createdAt: now });
    await markReadAt(ctx, leagueId, me._id, now);
    if (addressesSunny(body)) {
      await setTyping(ctx, leagueId, true);
      await ctx.scheduler.runAfter(0, internal.leagueChat.sunnyReply, { leagueId, askerId: me._id });
    }
    return id;
  },
});

export const react = mutation({
  args: { messageId: v.id("leagueMessages"), emoji: v.string() },
  returns: v.null(),
  handler: async (ctx, { messageId, emoji }) => {
    if (!(REACTIONS as readonly string[]).includes(emoji)) throw new ConvexError("Unknown reaction");
    const message = await ctx.db.get("leagueMessages", messageId);
    if (!message) throw new ConvexError("That message is gone");
    const me = await requireMember(ctx, message.leagueId);
    const rows = await ctx.db.query("leagueMessageReactions").withIndex("by_message", (q) => q.eq("messageId", messageId)).take(100);
    const existing = rows.find((row) => row.userId === me._id && row.emoji === emoji);
    if (existing) await ctx.db.delete("leagueMessageReactions", existing._id);
    else await ctx.db.insert("leagueMessageReactions", { messageId, leagueId: message.leagueId, userId: me._id, emoji });
    return null;
  },
});

async function markReadAt(ctx: MutationCtx, leagueId: Id<"leagues">, userId: Id<"users">, at: number) {
  const read = await ctx.db
    .query("leagueChatReads")
    .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", userId))
    .first();
  if (read) await ctx.db.patch("leagueChatReads", read._id, { lastReadAt: Math.max(read.lastReadAt, at) });
  else await ctx.db.insert("leagueChatReads", { leagueId, userId, lastReadAt: at });
}

async function setTyping(ctx: MutationCtx, leagueId: Id<"leagues">, typing: boolean) {
  const row = await ctx.db.query("leagueChatSunny").withIndex("by_league", (q) => q.eq("leagueId", leagueId)).first();
  if (row) await ctx.db.patch("leagueChatSunny", row._id, { typing });
  else await ctx.db.insert("leagueChatSunny", { leagueId, typing });
}

export const markRead = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const me = await requireMember(ctx, leagueId);
    await markReadAt(ctx, leagueId, me._id, Date.now());
    return null;
  },
});

/** Messages from others since I last opened the thread, capped at what the thread shows. */
export const unread = query({
  args: { leagueId: v.id("leagues") },
  returns: v.number(),
  handler: async (ctx, { leagueId }) => {
    const me = await requireUser(ctx);
    if ((await membershipOf(ctx, leagueId, me._id)) === null) return 0;
    const read = await ctx.db
      .query("leagueChatReads")
      .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", me._id))
      .first();
    const since = read?.lastReadAt ?? 0;
    const newer = await ctx.db
      .query("leagueMessages")
      .withIndex("by_league_created", (q) => q.eq("leagueId", leagueId).gt("createdAt", since))
      .take(99);
    return newer.filter((message) => message.userId !== me._id).length;
  },
});

/** Sunny's announcement of a league event (a verdict, a lead change, a veto, the last day). No model call. */
export const postEvent = internalMutation({
  args: { leagueId: v.id("leagues"), text: v.string() },
  returns: v.null(),
  handler: async (ctx, { leagueId, text }) => {
    await ctx.db.insert("leagueMessages", { leagueId, text: text.slice(0, MAX_TEXT), createdAt: Date.now() });
    return null;
  },
});

export const thread = internalQuery({
  args: { leagueId: v.id("leagues") },
  returns: v.array(v.object({ author: v.string(), fromSunny: v.boolean(), text: v.string() })),
  handler: async (ctx, { leagueId }) => {
    const messages = await recent(ctx, leagueId, CONTEXT_SIZE);
    const out = [];
    for (const message of messages) {
      const user = message.userId ? await ctx.db.get("users", message.userId) : null;
      out.push({ author: message.userId ? (user?.name ?? "A player") : "Sunny", fromSunny: !message.userId, text: message.text });
    }
    return out;
  },
});

export const finishReply = internalMutation({
  args: { leagueId: v.id("leagues"), text: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { leagueId, text }) => {
    await setTyping(ctx, leagueId, false);
    if (text) await ctx.db.insert("leagueMessages", { leagueId, text: text.slice(0, MAX_TEXT), createdAt: Date.now() });
    return null;
  },
});

/** Sunny answers a member who addressed it, reading the last messages of the thread as context. */
export const sunnyReply = internalAction({
  args: { leagueId: v.id("leagues"), askerId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { leagueId, askerId }) => {
    let text: string | null = null;
    try {
      const messages = await ctx.runQuery(internal.leagueChat.thread, { leagueId });
      const reply = await ctx.runAction(groupReply, { leagueId, askerId, messages });
      text = reply.text;
    } catch (error) {
      console.warn("Sunny could not answer in the league chat", error);
    }
    await ctx.runMutation(internal.leagueChat.finishReply, { leagueId, text });
    return null;
  },
});
