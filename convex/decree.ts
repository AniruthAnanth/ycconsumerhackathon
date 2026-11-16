/**
 * The profile decree: a herald's "Hear ye" proclamation about a player, written by the model
 * from their stats and cached per player in the decrees table. A cached decree stands until the
 * hash of the stats it was written from changes, or its own player rerolls it.
 */
import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, query, type QueryCtx } from "./_generated/server";
import { askJson } from "./ai";
import { netMoney } from "./leaderboards";
import { requireUser } from "./lib/auth";
import {
  cleanDecreeText,
  DECREE_INSTRUCTIONS,
  DECREE_SCHEMA,
  decreePrompt,
  epithetOrFallback,
  statsHash,
  type DecreeStats,
} from "./lib/decree";
import { currentStreak } from "./lib/scoring";
import { pacificDay } from "./lib/week";
import { bestSlot, profileStats, weakestSlot } from "./profile";
import { leagueStandings } from "./standings";

const MAX_LEAGUES = 50;
const MAX_WEEKS_PER_LEAGUE = 200;
const MAX_LEDGER_ROWS = 2000;
const MAX_VETOES = 2000;

const statsValidator = v.object({
  name: v.string(),
  seasonPoints: v.number(),
  wins: v.number(),
  losses: v.number(),
  streakDays: v.number(),
  bestSlot: v.union(v.string(), v.null()),
  weakestSlot: v.union(v.string(), v.null()),
  proofsVerified: v.number(),
  vetoesCast: v.number(),
  vetoesSuffered: v.number(),
  escrowUsd: v.number(),
  leagues: v.number(),
  rank: v.union(v.number(), v.null()),
  rankOf: v.union(v.number(), v.null()),
});

const decreeValidator = v.object({ text: v.string(), epithet: v.union(v.string(), v.null()) });

/** Everything the herald is told, gathered from the same helpers the profile and standings use. */
export async function decreeStats(ctx: QueryCtx, player: Doc<"users">): Promise<DecreeStats> {
  const userId = player._id;
  const { tasks, standingProofs, weekPoints, days } = await profileStats(ctx, player);
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_LEAGUES);
  memberships.sort((a, b) => a.joinedAt - b.joinedAt);

  let wins = 0;
  let losses = 0;
  let escrowUsd = 0;
  for (const membership of memberships) {
    const weeks = await ctx.db
      .query("weeks")
      .withIndex("by_league", (q) => q.eq("leagueId", membership.leagueId))
      .take(MAX_WEEKS_PER_LEAGUE);
    for (const week of weeks) {
      const matchups = await ctx.db.query("matchups").withIndex("by_week", (q) => q.eq("weekId", week._id)).collect();
      for (const matchup of matchups) {
        // Only frozen weeks count: a live week has no result yet.
        if (matchup.scoreA === undefined || matchup.scoreB === undefined) continue;
        const mine = matchup.userA === userId ? matchup.scoreA : matchup.userB === userId ? matchup.scoreB : null;
        if (mine === null || matchup.userA === matchup.userB) continue;
        const theirs = matchup.userA === userId ? matchup.scoreB : matchup.scoreA;
        if (mine > theirs) wins++;
        else if (mine < theirs) losses++;
      }
    }
    const ledger = await ctx.db
      .query("ledger")
      .withIndex("by_league", (q) => q.eq("leagueId", membership.leagueId))
      .take(MAX_LEDGER_ROWS);
    escrowUsd += netMoney(ledger).get(userId) ?? 0;
  }

  let rank: number | null = null;
  let rankOf: number | null = null;
  const firstLeague = memberships[0];
  if (firstLeague) {
    try {
      const standings = await leagueStandings(ctx, firstLeague.leagueId);
      const place = standings.findIndex((standing) => standing.userId === userId);
      if (place >= 0) {
        rank = place + 1;
        rankOf = standings.length;
      }
    } catch {
      // A league that has not started its first week has no table yet: unranked.
    }
  }

  const vetoesCast = (
    await ctx.db.query("taskVetoes").withIndex("by_user", (q) => q.eq("userId", userId)).take(MAX_VETOES)
  ).length;
  let vetoesSuffered = 0;
  for (const task of tasks) {
    vetoesSuffered += (await ctx.db.query("taskVetoes").withIndex("by_task", (q) => q.eq("taskId", task._id)).collect())
      .length;
  }

  return {
    name: player.name ?? "Player",
    seasonPoints: Math.round(weekPoints.reduce((sum, points) => sum + points, 0)),
    wins,
    losses,
    streakDays: currentStreak(days, pacificDay(Date.now())),
    bestSlot: bestSlot(tasks),
    weakestSlot: weakestSlot(tasks),
    proofsVerified: standingProofs.length,
    vetoesCast,
    vetoesSuffered,
    escrowUsd: Math.round(escrowUsd * 100) / 100,
    leagues: memberships.length,
    rank,
    rankOf,
  };
}

async function cachedDecree(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("decrees")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/**
 * The profile's decree: the stats, and the cached proclamation while it still matches them.
 * decree is null when nothing is cached or the stats moved on; the screen then calls generate.
 */
export const get = query({
  args: { userId: v.id("users") },
  returns: v.object({ stats: statsValidator, statsHash: v.string(), decree: v.union(decreeValidator, v.null()) }),
  handler: async (ctx, { userId }) => {
    await requireUser(ctx);
    const player = await ctx.db.get("users", userId);
    if (!player) throw new ConvexError("That player doesn't exist.");
    const stats = await decreeStats(ctx, player);
    const hash = statsHash(stats);
    const cached = await cachedDecree(ctx, userId);
    return {
      stats,
      statsHash: hash,
      decree: cached && cached.statsHash === hash ? { text: cached.text, epithet: cached.epithet ?? null } : null,
    };
  },
});

/** What generate needs, read as the caller so requireUser applies. */
export const forGeneration = internalQuery({
  args: { userId: v.id("users") },
  returns: v.object({
    callerId: v.id("users"),
    stats: statsValidator,
    statsHash: v.string(),
    cached: v.union(decreeValidator, v.null()),
  }),
  handler: async (ctx, { userId }) => {
    const caller = await requireUser(ctx);
    const player = await ctx.db.get("users", userId);
    if (!player) throw new ConvexError("That player doesn't exist.");
    const stats = await decreeStats(ctx, player);
    const hash = statsHash(stats);
    const cached = await cachedDecree(ctx, userId);
    return {
      callerId: caller._id,
      stats,
      statsHash: hash,
      cached: cached && cached.statsHash === hash ? { text: cached.text, epithet: cached.epithet ?? null } : null,
    };
  },
});

/** One row per player: the newest decree replaces the last. */
export const save = internalMutation({
  args: { userId: v.id("users"), statsHash: v.string(), text: v.string(), epithet: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await cachedDecree(ctx, args.userId);
    const row = { statsHash: args.statsHash, text: args.text, epithet: args.epithet, createdAt: Date.now() };
    if (existing) await ctx.db.patch("decrees", existing._id, row);
    else await ctx.db.insert("decrees", { userId: args.userId, ...row });
    return null;
  },
});

// Typed by hand: _generated/api lists modules explicitly and is regenerated only on deploy.
const forGenerationRef = makeFunctionReference<
  "query",
  { userId: Id<"users"> },
  { callerId: Id<"users">; stats: DecreeStats; statsHash: string; cached: { text: string; epithet: string | null } | null }
>("decree:forGeneration");
const saveRef = makeFunctionReference<
  "mutation",
  { userId: Id<"users">; statsHash: string; text: string; epithet: string },
  null
>("decree:save");

/**
 * Writes the player's decree when the cache is stale. reroll asks for a fresh one even when the
 * cache holds; only the player themself may reroll, so nobody burns model calls on someone else.
 */
export const generate = action({
  args: { userId: v.id("users"), reroll: v.optional(v.boolean()) },
  returns: decreeValidator,
  handler: async (ctx, { userId, reroll }): Promise<{ text: string; epithet: string | null }> => {
    const { callerId, stats, statsHash: hash, cached } = await ctx.runQuery(forGenerationRef, { userId });
    if (reroll && callerId !== userId) throw new ConvexError("Only you can reroll your own decree.");
    if (cached && !reroll) return cached;
    const answer = await askJson<{ proclamation: string; epithet: string }>({
      name: "profile_decree",
      instructions: DECREE_INSTRUCTIONS,
      text: decreePrompt(stats),
      schema: DECREE_SCHEMA,
    });
    const text = cleanDecreeText(answer.proclamation);
    const epithet = epithetOrFallback(cleanDecreeText(answer.epithet), stats.name);
    await ctx.runMutation(saveRef, { userId, statsHash: hash, text, epithet });
    return { text, epithet };
  },
});
