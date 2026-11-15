import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireUser } from "./lib/auth";
import {
  isSeasonLength,
  MAX_SEASON_WEEKS,
  resolveSettings,
  seasonOf,
  type LeagueSettings,
} from "./lib/schedule";
import { pairsAfterJoin, weekEndOf, weekStartOf } from "./lib/week";
import { leagueFormat, payout } from "./schema";
import { pairingsForWeek } from "./seasons";

const MAX_MEMBERS = 12;
const MAX_NAME_LENGTH = 40;
const MAX_STAKE_USD = 1000;
const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_ATTEMPTS = 20;
// No 0, O, 1, I or L: codes are read aloud and typed from a text message.
const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const visibility = v.union(v.literal("private"), v.literal("public"));

// What the creator may choose in Create League. Anything left out keeps the
// defaults in lib/schedule.ts: weekly payout, 8 weeks, round robin.
const settings = v.object({
  payout: v.optional(payout),
  seasonWeeks: v.optional(v.number()),
  format: v.optional(leagueFormat),
});

/**
 * The league's latest week row. This row, not the calendar, is "the current
 * week" everywhere, so a settled week stays on screen until the next starts.
 */
export async function currentWeek(
  ctx: QueryCtx | MutationCtx,
  leagueId: Id<"leagues">,
): Promise<Doc<"weeks"> | null> {
  // Weeks are only ever appended with a rising number, so the newest row by
  // creation time is the highest number.
  return await ctx.db
    .query("weeks")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .order("desc")
    .first();
}

/** Memberships in the order players joined, which is how matchups are paired. */
export async function membersInJoinOrder(
  ctx: QueryCtx | MutationCtx,
  leagueId: Id<"leagues">,
): Promise<Doc<"memberships">[]> {
  return await ctx.db
    .query("memberships")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .take(MAX_MEMBERS);
}

/**
 * The league's row for the calendar week we are in, rolling the league into
 * it (with fresh matchups) when its latest week is an earlier one.
 */
export async function ensureCurrentWeek(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
): Promise<Doc<"weeks">> {
  const now = Date.now();
  const latest = await currentWeek(ctx, leagueId);
  const startsAt = weekStartOf(now);
  if (latest !== null && latest.startsAt === startsAt) {
    return latest;
  }

  const number = latest === null ? 1 : latest.number + 1;
  const weekId = await ctx.db.insert("weeks", {
    leagueId,
    number,
    startsAt,
    endsAt: weekEndOf(startsAt),
    status: "open",
  });
  // The league's format decides who plays whom. For the default round robin
  // these are exactly weekPairings' pairs, extra pair for an odd league included.
  for (const { a, b } of await pairingsForWeek(ctx, leagueId, number)) {
    await ctx.db.insert("matchups", { weekId, userA: a, userB: b });
  }

  // A stake buys into one settlement: a week when the league pays out weekly,
  // a whole season when it holds stakes to the end. Once the next one opens,
  // every member owes again. Cleared here and not at settlement, so a settled
  // week still shows who paid into it.
  const league = await ctx.db.get("leagues", leagueId);
  if (league === null) {
    throw new ConvexError("League not found");
  }
  const { payout: paysOut, seasonWeeks } = resolveSettings(league);
  const stakeDue = paysOut === "weekly" || seasonOf(number, seasonWeeks).firstWeek === number;
  if (stakeDue && league.stakeUsd > 0) {
    for (const membership of await membersInJoinOrder(ctx, leagueId)) {
      if (membership.paid) {
        await ctx.db.patch("memberships", membership._id, { paid: false });
      }
    }
  }

  const week = await ctx.db.get("weeks", weekId);
  if (week === null) {
    throw new ConvexError("Week was not created");
  }
  return week;
}

/**
 * Puts a player in a league and into the current week's matchups. Returns
 * false, changing nothing, when they were already a member.
 */
export async function addMember(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  userId: Id<"users">,
): Promise<boolean> {
  const membersBefore = await membersInJoinOrder(ctx, league._id);
  if (membersBefore.some((member) => member.userId === userId)) {
    return false;
  }
  if (membersBefore.length >= league.maxMembers) {
    throw new ConvexError("This league is full");
  }

  // Ensure the week before inserting the membership: a week created here is
  // paired from the existing members, and the newcomer is added to it below
  // exactly like a mid-week joiner instead of being counted twice.
  const week = await ensureCurrentWeek(ctx, league._id);
  await ctx.db.insert("memberships", {
    leagueId: league._id,
    userId,
    // A free league has nothing to pay.
    paid: league.stakeUsd === 0,
    joinedAt: Date.now(),
  });

  const matchups = await ctx.db
    .query("matchups")
    .withIndex("by_week", (q) => q.eq("weekId", week._id))
    .take(MAX_MEMBERS);
  const pairs = pairsAfterJoin(
    matchups.map((matchup): [Id<"users">, Id<"users">] => [matchup.userA, matchup.userB]),
    membersBefore.map((member) => member.userId),
    userId,
  );
  if (pairs.length === 0) {
    return true;
  }
  const [userA, userB] = pairs[pairs.length - 1];
  if (pairs.length > matchups.length) {
    await ctx.db.insert("matchups", { weekId: week._id, userA, userB });
  } else {
    await ctx.db.patch("matchups", matchups[matchups.length - 1]._id, { userA, userB });
  }
  return true;
}

async function createLeagueWithCreator(
  ctx: MutationCtx,
  creator: Doc<"users">,
  league: { name: string; stakeUsd: number; visibility: "private" | "public" } & Partial<LeagueSettings>,
): Promise<{ leagueId: Id<"leagues">; inviteCode: string }> {
  const inviteCode = await uniqueInviteCode(ctx);
  const leagueId = await ctx.db.insert("leagues", {
    ...league,
    inviteCode,
    maxMembers: MAX_MEMBERS,
    createdBy: creator._id,
  });
  const created = await ctx.db.get("leagues", leagueId);
  if (created === null) {
    throw new ConvexError("League was not created");
  }
  await addMember(ctx, created, creator._id);
  return { leagueId, inviteCode };
}

async function uniqueInviteCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < INVITE_CODE_ATTEMPTS; attempt++) {
    let code = "";
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
    }
    const taken = await ctx.db
      .query("leagues")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", code))
      .first();
    if (taken === null) {
      return code;
    }
  }
  throw new ConvexError("Could not make an invite code, try again");
}

export const create = mutation({
  args: { name: v.string(), stakeUsd: v.number(), visibility, settings: v.optional(settings) },
  returns: v.object({ leagueId: v.id("leagues"), inviteCode: v.string() }),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx);
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError("Give the league a name");
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new ConvexError(`League names are at most ${MAX_NAME_LENGTH} characters`);
    }
    if (!Number.isInteger(args.stakeUsd) || args.stakeUsd < 0 || args.stakeUsd > MAX_STAKE_USD) {
      throw new ConvexError(`The stake must be a whole number from $0 to $${MAX_STAKE_USD}`);
    }
    const seasonWeeks = args.settings?.seasonWeeks;
    if (seasonWeeks !== undefined && !isSeasonLength(seasonWeeks)) {
      throw new ConvexError(`A season is 1 to ${MAX_SEASON_WEEKS} weeks`);
    }
    return await createLeagueWithCreator(ctx, caller, {
      name,
      stakeUsd: args.stakeUsd,
      visibility: args.visibility,
      ...args.settings,
    });
  },
});

export const joinByCode = mutation({
  args: { inviteCode: v.string() },
  returns: v.object({ leagueId: v.id("leagues") }),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx);
    const inviteCode = args.inviteCode.trim().toUpperCase();
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", inviteCode))
      .unique();
    if (league === null) {
      throw new ConvexError("No league has that invite code");
    }
    await addMember(ctx, league, caller._id);
    return { leagueId: league._id };
  },
});

export const quickMatch = mutation({
  args: { stakeUsd: v.union(v.literal(0), v.literal(5), v.literal(20)) },
  returns: v.object({ leagueId: v.id("leagues") }),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx);
    const publicLeagues = await ctx.db
      .query("leagues")
      .withIndex("by_visibility_stake", (q) =>
        q.eq("visibility", "public").eq("stakeUsd", args.stakeUsd),
      )
      .take(100);

    // Fill the fullest league first so open leagues reach a full table quickly.
    let best: { league: Doc<"leagues">; memberCount: number } | null = null;
    for (const league of publicLeagues) {
      const members = await membersInJoinOrder(ctx, league._id);
      const hasRoom = members.length < league.maxMembers;
      const alreadyIn = members.some((member) => member.userId === caller._id);
      if (hasRoom && !alreadyIn && (best === null || members.length > best.memberCount)) {
        best = { league, memberCount: members.length };
      }
    }
    if (best !== null) {
      await addMember(ctx, best.league, caller._id);
      return { leagueId: best.league._id };
    }

    const label = args.stakeUsd === 0 ? "Free" : `$${args.stakeUsd}`;
    const { leagueId } = await createLeagueWithCreator(ctx, caller, {
      name: `Quick Match ${label}`,
      stakeUsd: args.stakeUsd,
      visibility: "public",
    });
    return { leagueId };
  },
});

export const get = query({
  args: { leagueId: v.id("leagues") },
  returns: v.object({
    _id: v.id("leagues"),
    name: v.string(),
    inviteCode: v.string(),
    stakeUsd: v.number(),
    memberCount: v.number(),
    week: v.object({
      _id: v.id("weeks"),
      number: v.number(),
      startsAt: v.number(),
      endsAt: v.number(),
      status: v.union(v.literal("open"), v.literal("settled")),
    }),
  }),
  handler: async (ctx, args) => {
    // Standings are public like a sports table, so any signed-in player may
    // read a league; only the caller's identity is required.
    await requireUser(ctx);
    const league = await ctx.db.get("leagues", args.leagueId);
    if (league === null) {
      throw new ConvexError("League not found");
    }
    const week = await currentWeek(ctx, league._id);
    if (week === null) {
      throw new ConvexError("This league has not started its first week");
    }
    const members = await membersInJoinOrder(ctx, league._id);
    return {
      _id: league._id,
      name: league.name,
      inviteCode: league.inviteCode,
      stakeUsd: league.stakeUsd,
      memberCount: members.length,
      week: {
        _id: week._id,
        number: week.number,
        startsAt: week.startsAt,
        endsAt: week.endsAt,
        status: week.status,
      },
    };
  },
});

export const startWeek = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ensureCurrentWeek(ctx, args.leagueId);
    return null;
  },
});
