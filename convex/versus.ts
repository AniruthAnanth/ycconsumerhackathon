/**
 * 1v1 Versus: a player challenges one friend to a head-to-head week.
 *
 * A versus is a private league with mode "versus" and two seats, so everything a league has
 * (lineup scoring, standings.matchup, feed, drops, Keiki texts, the Whop buy-in and settlement)
 * works for it without a second code path. What is different lives here: making the game with
 * one friend, the head-to-head summary the versus home shows, the rematch, and growing a versus
 * into a league when more friends want in. The payout rule is lib/versusSettlement.ts, which
 * whop.closeWeek picks for a versus.
 *
 * Nothing here needs a community: one player and one friend get the whole game.
 */
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  addMember,
  createLeagueWithCreator,
  currentWeek,
  ensureCurrentWeek,
  membersInJoinOrder,
  paidInto,
} from "./leagues";
import { requireUser } from "./lib/auth";
import { leagueStandings } from "./standings";

const MAX_STAKE_USD = 1000;
/** A versus that grows into a league gets the seats an ordinary league has. */
const LEAGUE_SEATS = 12;
const FRIENDS_LISTED = 50;
const LEDGER_ROWS = 50;
/** The seeded demo game's invite code, which is also how a reset finds it again. */
const DEMO_INVITE_CODE = "VSMAYA";
const DEMO_STAKE_USD = 5;

const person = v.object({ userId: v.id("users"), name: v.string() });
const player = v.object({
  userId: v.id("users"),
  name: v.string(),
  paid: v.boolean(),
});

function firstName(user: Doc<"users"> | null): string {
  return user?.name?.split(" ")[0] ?? "a friend";
}

/** The two-seat league itself, with its creator in it. The friend joins by code or is added. */
async function createVersus(
  ctx: MutationCtx,
  creator: Doc<"users">,
  stakeUsd: number,
): Promise<{ league: Doc<"leagues">; inviteCode: string }> {
  const { leagueId, inviteCode } = await createLeagueWithCreator(ctx, creator, {
    name: `${firstName(creator)}'s challenge`,
    stakeUsd,
    visibility: "private",
    // One week, settled at its end: a versus is a single head-to-head, and a rematch is a new game.
    payout: "weekly",
    seasonWeeks: 1,
  });
  await ctx.db.patch("leagues", leagueId, { mode: "versus", maxMembers: 2 });
  const league = await ctx.db.get("leagues", leagueId);
  if (league === null) throw new ConvexError("The challenge was not created");
  return { league, inviteCode };
}

/** Puts the friend in the game and tells them, when they play by text. */
async function addOpponent(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  challenger: Doc<"users">,
  opponent: Doc<"users">,
) {
  await addMember(ctx, league, opponent._id);
  const stake =
    league.stakeUsd === 0
      ? "for bragging rights"
      : `for $${league.stakeUsd} each`;
  await ctx.scheduler.runAfter(0, internal.keiki.send, {
    userId: opponent._id,
    text: `${firstName(challenger)} challenged you to a Lineup week ${stake}. Highest score by Sunday night wins.`,
  });
}

export const challenge = mutation({
  args: {
    stakeUsd: v.number(),
    opponentId: v.optional(v.id("users")),
    opponentPhone: v.optional(v.string()),
  },
  returns: v.object({
    leagueId: v.id("leagues"),
    inviteCode: v.string(),
    opponentName: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx);
    if (
      !Number.isInteger(args.stakeUsd) ||
      args.stakeUsd < 0 ||
      args.stakeUsd > MAX_STAKE_USD
    ) {
      throw new ConvexError(
        `The stake must be a whole number from $0 to $${MAX_STAKE_USD}`,
      );
    }

    // A friend already on Lineup is put straight in; anyone else gets the invite code by text.
    let opponent: Doc<"users"> | null = null;
    if (args.opponentId !== undefined) {
      opponent = await ctx.db.get("users", args.opponentId);
      if (opponent === null)
        throw new ConvexError("That player isn't on Lineup");
    } else if (args.opponentPhone !== undefined) {
      opponent = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", args.opponentPhone))
        .first();
    }
    if (opponent?._id === caller._id)
      throw new ConvexError("Challenge someone other than yourself");

    const { league, inviteCode } = await createVersus(
      ctx,
      caller,
      args.stakeUsd,
    );
    if (opponent !== null) await addOpponent(ctx, league, caller, opponent);
    return {
      leagueId: league._id,
      inviteCode,
      opponentName: opponent === null ? null : (opponent.name ?? "Player"),
    };
  },
});

/** Players the caller already shares a league or versus with: the people a challenge goes to in one tap. */
export const friends = query({
  args: {},
  returns: v.array(person),
  handler: async (ctx) => {
    const caller = await requireUser(ctx);
    const mine = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", caller._id))
      .take(FRIENDS_LISTED);
    const seen = new Set<Id<"users">>([caller._id]);
    const friends: { userId: Id<"users">; name: string }[] = [];
    for (const { leagueId } of mine) {
      for (const member of await membersInJoinOrder(ctx, leagueId)) {
        if (seen.has(member.userId)) continue;
        seen.add(member.userId);
        const user = await ctx.db.get("users", member.userId);
        if (user?.name) friends.push({ userId: user._id, name: user.name });
      }
    }
    return friends.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** How the versus home reads one game. Null for an ordinary league, so a screen can ask about any. */
export const get = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(
    v.null(),
    v.object({
      leagueId: v.id("leagues"),
      inviteCode: v.string(),
      stakeUsd: v.number(),
      status: v.union(
        v.literal("waiting"),
        v.literal("live"),
        v.literal("settled"),
      ),
      me: player,
      opponent: v.union(player, v.null()),
      potUsd: v.number(),
      endsAt: v.number(),
      result: v.optional(
        v.object({
          winnerId: v.union(v.id("users"), v.null()),
          payouts: v.array(
            v.object({
              userId: v.id("users"),
              name: v.string(),
              amountUsd: v.number(),
            }),
          ),
        }),
      ),
    }),
  ),
  handler: async (ctx, { leagueId }) => {
    const caller = await requireUser(ctx);
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null || league.mode !== "versus") return null;
    const week = await currentWeek(ctx, leagueId);
    if (week === null) return null;

    const members = await membersInJoinOrder(ctx, leagueId);
    const isPaid = await paidInto(ctx, league, week);
    const sides = await Promise.all(
      members.map(async ({ userId }) => ({
        userId,
        name: (await ctx.db.get("users", userId))?.name ?? "Player",
        paid: isPaid(userId),
      })),
    );
    const me = sides.find((side) => side.userId === caller._id);
    if (me === undefined) throw new ConvexError("You aren't in this game");
    const opponent = sides.find((side) => side.userId !== caller._id) ?? null;

    const ledger = (
      await ctx.db
        .query("ledger")
        .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
        .take(LEDGER_ROWS)
    ).filter((row) => row.weekId === week._id);
    const potCents = ledger
      .filter((row) => row.kind === "buy_in")
      .reduce((sum, row) => sum + Math.round(row.amountUsd * 100), 0);

    const base = {
      leagueId,
      inviteCode: league.inviteCode,
      stakeUsd: league.stakeUsd,
      me,
      opponent,
      potUsd: potCents / 100,
      endsAt: week.endsAt,
    };
    if (week.status !== "settled")
      return {
        ...base,
        status: opponent === null ? ("waiting" as const) : ("live" as const),
      };

    // The higher score wins, on the same table the settlement used; equal scores are a tie.
    const [first, second] = await leagueStandings(ctx, leagueId, week._id);
    const winnerId =
      second === undefined || first.points === second.points
        ? null
        : first.userId;
    const paidOut = new Map<Id<"users">, number>();
    for (const row of ledger) {
      if (
        (row.kind === "refund" || row.kind === "winnings") &&
        row.userId !== undefined
      ) {
        paidOut.set(
          row.userId,
          (paidOut.get(row.userId) ?? 0) + Math.round(row.amountUsd * 100),
        );
      }
    }
    const payouts = sides
      .filter((side) => paidOut.has(side.userId))
      .map((side) => ({
        userId: side.userId,
        name: side.name,
        amountUsd: (paidOut.get(side.userId) ?? 0) / 100,
      }));
    return {
      ...base,
      status: "settled" as const,
      result: { winnerId, payouts },
    };
  },
});

async function requireVersusMember(ctx: MutationCtx, leagueId: Id<"leagues">) {
  const caller = await requireUser(ctx);
  const league = await ctx.db.get("leagues", leagueId);
  if (league === null || league.mode !== "versus")
    throw new ConvexError("That isn't a versus game");
  const members = await membersInJoinOrder(ctx, leagueId);
  if (!members.some((member) => member.userId === caller._id))
    throw new ConvexError("You aren't in this game");
  return { caller, league, members };
}

/** Same friend, same stake, a fresh game. Only once this one is settled, so a game can't be abandoned for a better start. */
export const rematch = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.object({ leagueId: v.id("leagues") }),
  handler: async (ctx, { leagueId }) => {
    const { caller, league, members } = await requireVersusMember(
      ctx,
      leagueId,
    );
    const week = await currentWeek(ctx, leagueId);
    if (week?.status !== "settled")
      throw new ConvexError("Finish this game first");
    const opponentId = members.find(
      (member) => member.userId !== caller._id,
    )?.userId;
    const opponent =
      opponentId === undefined ? null : await ctx.db.get("users", opponentId);
    if (opponent === null)
      throw new ConvexError("Nobody accepted this challenge");

    const { league: next } = await createVersus(ctx, caller, league.stakeUsd);
    await addOpponent(ctx, next, caller, opponent);
    return { leagueId: next._id };
  },
});

/**
 * Turns a versus into a league so more friends can join: the same league, the same week, the
 * same pot. It just gains seats and stops being head-to-head, so it settles by the league rule.
 */
export const toLeague = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.object({ leagueId: v.id("leagues"), inviteCode: v.string() }),
  handler: async (ctx, { leagueId }) => {
    const { league, members } = await requireVersusMember(ctx, leagueId);
    const names = await Promise.all(
      members.map(async ({ userId }) =>
        firstName(await ctx.db.get("users", userId)),
      ),
    );
    await ctx.db.patch("leagues", leagueId, {
      mode: "league",
      maxMembers: LEAGUE_SEATS,
      name: `${names.join(" & ")}'s League`,
    });
    return { leagueId, inviteCode: league.inviteCode };
  },
});

/** The switcher's name for a versus as one player sees it: "vs Maya". users.me uses it. */
export async function versusLabel(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  viewerId: Id<"users">,
): Promise<string> {
  const members = await membersInJoinOrder(ctx, leagueId);
  const opponent = members.find((member) => member.userId !== viewerId);
  return `vs ${opponent === undefined ? "a friend" : firstName(await ctx.db.get("users", opponent.userId))}`;
}

/**
 * The demo's versus: Sam against Maya for $5 each, both paid, in the current week. Their seeded
 * lineups already score here, because a lineup scores in every league its player is in. Rebuilt
 * from scratch on every call (seed.reset calls it), found again by its invite code.
 */
export async function seedDemoVersus(
  ctx: MutationCtx,
  samId: Id<"users">,
  mayaId: Id<"users">,
): Promise<void> {
  const old = await ctx.db
    .query("leagues")
    .withIndex("by_inviteCode", (q) => q.eq("inviteCode", DEMO_INVITE_CODE))
    .unique();
  if (old !== null) {
    for (const week of await ctx.db
      .query("weeks")
      .withIndex("by_league", (q) => q.eq("leagueId", old._id))
      .take(LEDGER_ROWS)) {
      for (const matchup of await ctx.db
        .query("matchups")
        .withIndex("by_week", (q) => q.eq("weekId", week._id))
        .take(LEDGER_ROWS)) {
        await ctx.db.delete("matchups", matchup._id);
      }
      await ctx.db.delete("weeks", week._id);
    }
    for (const row of await ctx.db
      .query("ledger")
      .withIndex("by_league", (q) => q.eq("leagueId", old._id))
      .take(LEDGER_ROWS)) {
      await ctx.db.delete("ledger", row._id);
    }
    for (const member of await membersInJoinOrder(ctx, old._id))
      await ctx.db.delete("memberships", member._id);
    await ctx.db.delete("leagues", old._id);
  }

  const leagueId = await ctx.db.insert("leagues", {
    name: "Sam's challenge",
    inviteCode: DEMO_INVITE_CODE,
    stakeUsd: DEMO_STAKE_USD,
    visibility: "private",
    maxMembers: 2,
    createdBy: samId,
    payout: "weekly",
    seasonWeeks: 1,
    mode: "versus",
  });
  const league = await ctx.db.get("leagues", leagueId);
  if (league === null) throw new ConvexError("The demo versus was not created");
  await addMember(ctx, league, samId);
  await addMember(ctx, league, mayaId);
  const week = await ensureCurrentWeek(ctx, leagueId);
  for (const userId of [samId, mayaId]) {
    await ctx.db.insert("ledger", {
      leagueId,
      weekId: week._id,
      userId,
      kind: "buy_in",
      amountUsd: DEMO_STAKE_USD,
      idempotencyKey: `demo:${week._id}:${userId}:buy_in`,
      createdAt: Date.now(),
    });
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_league_user", (q) =>
        q.eq("leagueId", leagueId).eq("userId", userId),
      )
      .unique();
    if (membership !== null)
      await ctx.db.patch("memberships", membership._id, { paid: true });
  }
}

/** npx convex run versus:seedDemo, for a deployment that was reset before this game existed. */
export const seedDemo = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const byName = async (name: string) =>
      (
        await ctx.db
          .query("users")
          .filter((q) =>
            q.and(q.eq(q.field("isSeed"), true), q.eq(q.field("name"), name)),
          )
          .first()
      )?._id;
    const [samId, mayaId] = [
      await byName("Sam Patel"),
      await byName("Maya Chen"),
    ];
    if (samId === undefined || mayaId === undefined)
      throw new ConvexError("Run seed:reset first");
    await seedDemoVersus(ctx, samId, mayaId);
    return null;
  },
});
