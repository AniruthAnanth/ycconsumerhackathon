/**
 * Invites and referral rewards.
 *
 * A player shares one short link per league (or versus, which is a two-seat league). The link
 * is /i/<token> on the Convex site: a page that opens the app at /invite/<token>, where a new
 * friend gives a name and phone and is dropped straight into that game. Joining that way, as a
 * player new to Lineup, records a referral; once the friend locks a first lineup the inviter
 * earns Recruiter points. Recruiter points never enter league points, so no pot or stake moves.
 * The rules themselves are in lib/referralRules.ts.
 */
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { httpAction, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { addMember } from "./leagues";
import { requireUser } from "./lib/auth";
import {
  REFERRAL_POINTS,
  appLink,
  badgeFor,
  countsAsReferral,
  inviteMessage,
  invitePage as renderInvitePage,
  isToken,
  makeToken,
  recruiterPoints,
  sanitizedAppPrefix,
} from "./lib/referralRules";

/** Reads only the database, so the leaderboards can call it with their narrower context. */
type ReadCtx = Pick<QueryCtx, "db">;

const TOKEN_ATTEMPTS = 5;
/** More friends than anyone brings in a hackathon week; keeps every read bounded. */
const FRIENDS_READ = 100;
const LINEUPS_READ = 20;

const mode = v.union(v.literal("league"), v.literal("versus"));
const badge = v.union(v.literal("Recruiter"), v.literal("Top Recruiter"), v.null());

function modeOf(league: Doc<"leagues">): "league" | "versus" {
  return league.mode === "versus" ? "versus" : "league";
}

function shortUrl(token: string): string {
  return `${process.env.CONVEX_SITE_URL}/i/${token}`;
}

async function linkByToken(ctx: QueryCtx, token: string): Promise<Doc<"inviteLinks"> | null> {
  const normalized = token.trim().toUpperCase();
  if (!isToken(normalized)) return null;
  return await ctx.db
    .query("inviteLinks")
    .withIndex("by_token", (q) => q.eq("token", normalized))
    .unique();
}

async function membership(ctx: QueryCtx, leagueId: Id<"leagues">, userId: Id<"users">) {
  return await ctx.db
    .query("memberships")
    .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", userId))
    .unique();
}

/** True once the player has locked any lineup: the moment a referral pays. */
async function hasLockedLineup(ctx: ReadCtx, userId: Id<"users">): Promise<boolean> {
  const lineups = await ctx.db
    .query("lineups")
    .withIndex("by_user_week", (q) => q.eq("userId", userId))
    .take(LINEUPS_READ);
  return lineups.some((lineup) => lineup.lockedAt !== undefined);
}

type Friend = { userId: Id<"users">; name: string; status: "joined" | "locked"; points: number };

async function friendsOf(ctx: ReadCtx, inviterId: Id<"users">): Promise<Friend[]> {
  const referrals = await ctx.db
    .query("referrals")
    .withIndex("by_inviter", (q) => q.eq("inviterId", inviterId))
    .order("desc")
    .take(FRIENDS_READ);
  const friends: Friend[] = [];
  for (const referral of referrals) {
    const friend = await ctx.db.get("users", referral.inviteeId);
    const locked = await hasLockedLineup(ctx, referral.inviteeId);
    friends.push({
      userId: referral.inviteeId,
      name: friend?.name ?? "A friend",
      status: locked ? "locked" : "joined",
      points: locked ? REFERRAL_POINTS : 0,
    });
  }
  return friends;
}

/** A player's Recruiter tally. Exported for the Recruiters leaderboard. */
export async function recruiterTally(ctx: ReadCtx, userId: Id<"users">) {
  const friends = await friendsOf(ctx, userId);
  const locked = friends.filter((friend) => friend.status === "locked").length;
  return { friends, invited: friends.length, locked, recruiterPoints: recruiterPoints(locked), badge: badgeFor(locked) };
}

export const createLink = mutation({
  args: { leagueId: v.id("leagues"), appUrl: v.optional(v.string()) },
  returns: v.object({ token: v.string(), url: v.string(), message: v.string() }),
  handler: async (ctx, args) => {
    const inviter = await requireUser(ctx);
    const league = await ctx.db.get("leagues", args.leagueId);
    if (league === null) throw new ConvexError("League not found");
    if ((await membership(ctx, league._id, inviter._id)) === null) {
      throw new ConvexError("Join the league before inviting friends");
    }
    const appUrl = sanitizedAppPrefix(args.appUrl);

    // Sharing again reuses the link, so every text a player has sent keeps working.
    let link = await ctx.db
      .query("inviteLinks")
      .withIndex("by_inviter_league", (q) => q.eq("inviterId", inviter._id).eq("leagueId", league._id))
      .first();
    if (link === null) {
      const token = await unusedToken(ctx);
      const id = await ctx.db.insert("inviteLinks", { token, inviterId: inviter._id, leagueId: league._id, appUrl, createdAt: Date.now() });
      link = (await ctx.db.get("inviteLinks", id))!;
    } else if (appUrl !== undefined && appUrl !== link.appUrl) {
      await ctx.db.patch("inviteLinks", link._id, { appUrl });
    }

    const url = shortUrl(link.token);
    return {
      token: link.token,
      url,
      message: inviteMessage({
        inviterName: inviter.name ?? "A friend",
        leagueName: league.name,
        versus: modeOf(league) === "versus",
        inviteCode: league.inviteCode,
        url,
      }),
    };
  },
});

async function unusedToken(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < TOKEN_ATTEMPTS; attempt++) {
    const token = makeToken();
    if ((await linkByToken(ctx, token)) === null) return token;
  }
  throw new ConvexError("Could not make an invite link, try again");
}

export const preview = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      inviterName: v.string(),
      leagueId: v.id("leagues"),
      leagueName: v.string(),
      mode,
      stakeUsd: v.number(),
      memberCount: v.number(),
      alreadyMember: v.boolean(),
      isSelf: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx);
    const link = await linkByToken(ctx, args.token);
    if (link === null) return null;
    const league = await ctx.db.get("leagues", link.leagueId);
    if (league === null) return null;
    const inviter = await ctx.db.get("users", link.inviterId);
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .take(league.maxMembers);
    return {
      inviterName: inviter?.name ?? "A friend",
      leagueId: league._id,
      leagueName: league.name,
      mode: modeOf(league),
      stakeUsd: league.stakeUsd,
      memberCount: members.length,
      alreadyMember: members.some((member) => member.userId === caller._id),
      isSelf: link.inviterId === caller._id,
    };
  },
});

export const accept = mutation({
  args: { token: v.string() },
  returns: v.object({ leagueId: v.id("leagues"), mode }),
  handler: async (ctx, args) => {
    const invitee = await requireUser(ctx);
    const link = await linkByToken(ctx, args.token);
    if (link === null) throw new ConvexError("This invite link is not valid");
    const league = await ctx.db.get("leagues", link.leagueId);
    if (league === null) throw new ConvexError("That league no longer exists");

    // Read before joining: the referral rule asks whether the friend was new to Lineup.
    const inviteeLeagues = (
      await ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", invitee._id))
        .take(1)
    ).length;
    const alreadyReferred =
      (await ctx.db
        .query("referrals")
        .withIndex("by_invitee", (q) => q.eq("inviteeId", invitee._id))
        .first()) !== null;

    // addMember changes nothing for a member, and throws when the league is full.
    await addMember(ctx, league, invitee._id);

    if (countsAsReferral({ inviterId: link.inviterId, inviteeId: invitee._id, inviteeLeagues, alreadyReferred })) {
      await ctx.db.insert("referrals", { inviterId: link.inviterId, inviteeId: invitee._id, leagueId: league._id, joinedAt: Date.now() });
    }
    return { leagueId: league._id, mode: modeOf(league) };
  },
});

const tally = { recruiterPoints: v.number(), invited: v.number(), locked: v.number(), badge };

export const mine = query({
  args: {},
  returns: v.object({
    ...tally,
    friends: v.array(
      v.object({ userId: v.id("users"), name: v.string(), status: v.union(v.literal("joined"), v.literal("locked")), points: v.number() }),
    ),
  }),
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const { friends, invited, locked, recruiterPoints, badge } = await recruiterTally(ctx, me._id);
    return { friends, invited, locked, recruiterPoints, badge };
  },
});

/** Only counts, never who the friends are, so any signed-in player may read another's badge. */
export const forUser = query({
  args: { userId: v.id("users") },
  returns: v.object(tally),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const { invited, locked, recruiterPoints, badge } = await recruiterTally(ctx, args.userId);
    return { invited, locked, recruiterPoints, badge };
  },
});

export const linkPage = internalQuery({
  args: { token: v.string() },
  returns: v.union(v.null(), v.object({ inviterName: v.string(), leagueName: v.string(), inviteCode: v.string(), openUrl: v.string() })),
  handler: async (ctx, args) => {
    const link = await linkByToken(ctx, args.token);
    if (link === null) return null;
    const league = await ctx.db.get("leagues", link.leagueId);
    if (league === null) return null;
    const inviter = await ctx.db.get("users", link.inviterId);
    return {
      inviterName: inviter?.name?.split(" ")[0] ?? "A friend",
      leagueName: league.name,
      inviteCode: league.inviteCode,
      openUrl: appLink(link.appUrl, link.token),
    };
  },
});

/** GET /i/<token>: the page a texted link opens. */
export const invitePage = httpAction(async (ctx, request) => {
  const token = new URL(request.url).pathname.split("/").filter(Boolean).pop() ?? "";
  const info = await ctx.runQuery(internal.referrals.linkPage, { token });
  return new Response(renderInvitePage(info), {
    status: info === null ? 404 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
});

/**
 * The demo player's recruits. Sam brought in Ava and Leo, who both have locked lineups in the
 * seed, so Sam's Profile shows the Recruiter badge with 50 points. Idempotent: run it again
 * after a reset with npx convex run referrals:seedDemo.
 */
export async function seedDemoReferrals(ctx: MutationCtx, inviterId: Id<"users">, inviteeIds: Id<"users">[], leagueId: Id<"leagues">) {
  for (const inviteeId of inviteeIds) {
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_invitee", (q) => q.eq("inviteeId", inviteeId))
      .first();
    if (existing !== null) continue;
    await ctx.db.insert("referrals", { inviterId, inviteeId, leagueId, joinedAt: Date.now() });
  }
}

export const seedDemo = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", "YCHACK"))
      .unique();
    if (league === null) throw new ConvexError("Run seed:reset first");
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .take(league.maxMembers);
    const seeded = new Map<string, Id<"users">>();
    for (const member of members) {
      const user = await ctx.db.get("users", member.userId);
      if (user?.isSeed && user.name) seeded.set(user.name, user._id);
    }
    const [sam, ava, leo] = ["Sam Patel", "Ava Kim", "Leo Martinez"].map((name) => seeded.get(name));
    if (sam === undefined || ava === undefined || leo === undefined) throw new ConvexError("Run seed:reset first");
    await seedDemoReferrals(ctx, sam, [ava, leo], league._id);
    return null;
  },
});
