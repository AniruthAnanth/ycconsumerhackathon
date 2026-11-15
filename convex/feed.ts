/**
 * The league feed: every verified proof by the league's members, newest first, with what the
 * referee said about it and how the league reacted (reactions, close calls, challenges).
 */
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { membersInJoinOrder } from "./leagues";
import { requireUser } from "./lib/auth";
import { UNNAMED_PLAYER } from "./lib/names";
import { CLOSE_CALL_CONFIDENCE } from "./lib/verdict";
import { slot } from "./schema";

// ---- Rules (pure) -----------------------------------------------------------------------------

/**
 * A pass the referee was not sure about; the feed flags it to invite a challenge. The threshold is
 * the one the verdict screen uses, so a proof is never a close call in one place and not the other.
 */
export function isCloseCall(proof: { pass: boolean; confidence: number }): boolean {
  return proof.pass && proof.confidence <= CLOSE_CALL_CONFIDENCE;
}

export type FeedKind = "proof" | "drop" | "group";

/** Quick-time results read as drops in the feed, a group session's photo as a group. */
export function feedKind(source: Doc<"tasks">["source"]): FeedKind {
  if (source === "group") return "group";
  if (source === "drop") return "drop";
  return "proof";
}

export type ReactionSummary = { emoji: string; count: number; mine: boolean };

/** One entry per emoji in use, most used first. Ties keep first-used order so buttons don't jump around. */
export function summariseReactions(
  reactions: { userId: string; emoji: string }[],
  viewerId: string,
): ReactionSummary[] {
  const byEmoji = new Map<string, ReactionSummary>();
  for (const reaction of reactions) {
    const summary = byEmoji.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, mine: false };
    summary.count += 1;
    if (reaction.userId === viewerId) summary.mine = true;
    byEmoji.set(reaction.emoji, summary);
  }
  return [...byEmoji.values()].sort((a, b) => b.count - a.count);
}

export type VoteTally = { legit: number; notLegit: number; myVote?: boolean };

export function tallyVotes(votes: { userId: string; legit: boolean }[], viewerId: string): VoteTally {
  const tally: VoteTally = { legit: 0, notLegit: 0 };
  for (const vote of votes) {
    if (vote.legit) tally.legit += 1;
    else tally.notLegit += 1;
    if (vote.userId === viewerId) tally.myVote = vote.legit;
  }
  return tally;
}

/**
 * Whether the viewer may vote on a challenge, so the feed can hide the Legit / Not Legit buttons.
 * The vote belongs to the rest of the challenge's league: the proof's owner and the challenger
 * are the two parties and don't vote. challenges.vote enforces the same rule.
 */
export function canVoteOn(
  challenge: { status: Doc<"challenges">["status"]; leagueId: string; challengerId: string },
  viewer: { userId: string; leagueId: string },
  proofOwnerId: string,
): boolean {
  return (
    challenge.status === "open" &&
    challenge.leagueId === viewer.leagueId &&
    viewer.userId !== proofOwnerId &&
    viewer.userId !== challenge.challengerId
  );
}

/** An emoji can be several code points joined together (a flag, a family), but never a sentence. */
export const MAX_EMOJI_LENGTH = 16;

export function isReactionEmoji(emoji: string): boolean {
  return emoji.length > 0 && emoji.length <= MAX_EMOJI_LENGTH && !/\s/.test(emoji);
}

// ---- Queries and mutations --------------------------------------------------------------------

/** About a week of a busy league. The screen has no paging, so this is also the page size. */
const FEED_LIMIT = 50;
/** Upper bounds on per-document fan-out, far above anything a league of friends produces. */
const MAX_MEMBERS = 100;
const MAX_REACTIONS = 200;

const feedItem = v.object({
  proofId: v.id("proofs"),
  kind: v.union(v.literal("proof"), v.literal("drop"), v.literal("group")),
  user: v.object({ _id: v.id("users"), name: v.string(), avatarUrl: v.optional(v.string()) }),
  taskTitle: v.string(),
  slot,
  points: v.number(),
  reason: v.string(),
  caption: v.string(),
  mediaUrl: v.optional(v.string()),
  mediaType: v.union(v.literal("photo"), v.literal("video"), v.literal("canvas")),
  createdAt: v.number(),
  closeCall: v.boolean(),
  reactions: v.array(v.object({ emoji: v.string(), count: v.number(), mine: v.boolean() })),
  challenge: v.optional(
    v.object({
      challengeId: v.id("challenges"),
      status: v.union(v.literal("open"), v.literal("upheld"), v.literal("overturned")),
      legit: v.number(),
      notLegit: v.number(),
      myVote: v.optional(v.boolean()),
      canVote: v.boolean(),
      closesAt: v.number(),
      byReferee: v.optional(v.boolean()),
    }),
  ),
});

export const list = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(feedItem),
  handler: async (ctx, { leagueId }) => {
    const viewer = await requireUser(ctx);
    const memberships = await membersInJoinOrder(ctx, leagueId);
    // An empty feed, not an error: the screen may still be mounted for a league the player just left.
    if (!memberships.some((m) => m.userId === viewer._id)) return [];

    // A proof belongs to its player, not to one league (one lineup scores in every league the
    // player is in), so a league's feed is the union of its members' verified proofs.
    const perMember = await Promise.all(
      memberships.map((m) =>
        ctx.db
          .query("proofs")
          .withIndex("by_user_week", (q) => q.eq("userId", m.userId))
          .order("desc")
          .filter((q) => q.eq(q.field("pass"), true))
          .take(FEED_LIMIT),
      ),
    );
    const newestFirst = perMember.flat().sort((a, b) => b.createdAt - a.createdAt);

    const items = [];
    for (const proof of newestFirst) {
      if (items.length === FEED_LIMIT) break;
      const item = await feedItemFor(ctx, proof, leagueId, viewer._id);
      if (item) items.push(item);
    }
    return items;
  },
});

/** Null when the proof has no place in this league's feed. */
async function feedItemFor(
  ctx: QueryCtx,
  proof: Doc<"proofs">,
  leagueId: Id<"leagues">,
  viewerId: Id<"users">,
) {
  const [task, user] = await Promise.all([
    ctx.db.get("tasks", proof.taskId),
    ctx.db.get("users", proof.userId),
  ]);
  if (!task || !user) return null;
  // A drop is one league's event: its result shows, and scores, only there.
  if (task.dropId) {
    const drop = await ctx.db.get("drops", task.dropId);
    if (drop && drop.leagueId !== leagueId) return null;
  }

  const [avatarUrl, mediaUrl, reactions, challenge] = await Promise.all([
    user.avatarStorageId ? ctx.storage.getUrl(user.avatarStorageId) : (user.image ?? null),
    proof.storageId ? ctx.storage.getUrl(proof.storageId) : null,
    ctx.db
      .query("reactions")
      .withIndex("by_proof", (q) => q.eq("proofId", proof._id))
      .take(MAX_REACTIONS),
    // A proof can be challenged once, ever, so there is at most one row.
    ctx.db
      .query("challenges")
      .withIndex("by_proof", (q) => q.eq("proofId", proof._id))
      .first(),
  ]);
  const votes = challenge
    ? await ctx.db
        .query("votes")
        .withIndex("by_challenge", (q) => q.eq("challengeId", challenge._id))
        .take(MAX_MEMBERS)
    : [];

  return {
    proofId: proof._id,
    kind: feedKind(task.source),
    user: { _id: user._id, name: user.name ?? UNNAMED_PLAYER, ...(avatarUrl ? { avatarUrl } : {}) },
    taskTitle: task.title,
    slot: task.slot,
    points: task.points,
    reason: proof.reason,
    caption: proof.caption,
    ...(mediaUrl ? { mediaUrl } : {}),
    mediaType: proof.mediaType,
    createdAt: proof.createdAt,
    closeCall: isCloseCall(proof),
    reactions: summariseReactions(reactions, viewerId),
    ...(challenge
      ? {
          challenge: {
            challengeId: challenge._id,
            status: challenge.status,
            closesAt: challenge.closesAt,
            canVote: canVoteOn(challenge, { userId: viewerId, leagueId }, proof.userId),
            ...(challenge.byReferee ? { byReferee: true } : {}),
            ...tallyVotes(votes, viewerId),
          },
        }
      : {}),
  };
}

/** Toggles the caller's reaction: the same emoji a second time takes it back. */
export const react = mutation({
  args: { proofId: v.id("proofs"), emoji: v.string() },
  returns: v.null(),
  handler: async (ctx, { proofId, emoji }) => {
    const user = await requireUser(ctx);
    if (!isReactionEmoji(emoji)) throw new ConvexError("Reactions are a single emoji.");
    const proof = await ctx.db.get("proofs", proofId);
    if (!proof) throw new ConvexError("That proof is gone.");
    if (!(await shareALeague(ctx, user._id, proof.userId))) {
      throw new ConvexError("You can only react to proofs in your leagues.");
    }

    const onProof = await ctx.db
      .query("reactions")
      .withIndex("by_proof", (q) => q.eq("proofId", proofId))
      .take(MAX_REACTIONS);
    const mine = onProof.find((r) => r.userId === user._id && r.emoji === emoji);
    if (mine) await ctx.db.delete("reactions", mine._id);
    else await ctx.db.insert("reactions", { proofId, userId: user._id, emoji });
    return null;
  },
});

async function shareALeague(ctx: QueryCtx, a: Id<"users">, b: Id<"users">): Promise<boolean> {
  if (a === b) return true;
  const [mine, theirs] = await Promise.all(
    [a, b].map((userId) =>
      ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(MAX_MEMBERS),
    ),
  );
  const myLeagues = new Set(mine.map((m) => m.leagueId));
  return theirs.some((m) => myLeagues.has(m.leagueId));
}
