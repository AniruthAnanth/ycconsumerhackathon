/**
 * Test fixtures on the shared deployment.
 *
 * Threads that check the app against the deployed backend leave leagues and players behind, and
 * those show up in the global leaderboards, the screenshots and the demo recording. `remove`
 * deletes them with every row that hangs off them; `list` names what it would delete. A new
 * table keyed to a league or a player needs a line in removeLeague or removePlayer below.
 *
 *   npx convex run fixtures:list
 *   npx convex run fixtures:remove
 *
 * A fixture is recognised by its name alone (isFixtureName), so name whatever a check creates
 * that way. The seeded leagues and the seeded players are never fixtures, whatever they are
 * called, and neither is an account whose name does not match, which is every real device.
 *
 * Before a recording that is not enough, because most test players were given ordinary names.
 * `everything` takes every league and player the seed did not make, and `keep` lists the
 * accounts of real phones, which stay. So does a league one of them made or is in, with the
 * testers taken out of it, unless its name says it is a fixture:
 *
 *   npx convex run fixtures:list '{"everything": true, "keep": ["<user id>"]}'
 *   npx convex run fixtures:remove '{"everything": true, "keep": ["<user id>"]}'
 *
 * `only` takes exactly the players named, a real phone's included, so that phone starts over as a
 * new user. Their leagues go only when nobody else is in them; elsewhere they just leave:
 *
 *   npx convex run fixtures:remove '{"only": ["<user id>"]}'
 *
 * Stored photos are left alone: a fixture proof may point at the same file as a seeded one.
 */
import { v, type ObjectType } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";

/** "zz …", "Whop E2E …", "Canvas check …", or any name carrying a thread code such as "(YCCO-7)". */
export function isFixtureName(name: string | undefined): boolean {
  if (name === undefined) return false;
  return /^(zz |Whop E2E|Canvas check)/.test(name) || name.includes("(YCCO-");
}

/**
 * The leagues the demo is set in, by invite code: seed.ts creates the demo league and the two
 * public leagues Quick Match lands in, and versus.ts the demo's game of Sam against Maya. They
 * are never fixtures.
 */
const SEEDED_LEAGUE_INVITE_CODES = ["YCHACK", "MATCHA", "MATCHB", "VSMAYA"];

/** What goes. With neither set, only what is named as a fixture. */
const scope = {
  // Every league and player the seed did not make, whatever they are called.
  everything: v.optional(v.boolean()),
  // Players who stay all the same: the accounts of real phones. The leagues they made or are in
  // stay with them, unless named as fixtures.
  keep: v.optional(v.array(v.id("users"))),
  // Exactly these players and the leagues nobody else is in, and nothing named as a fixture.
  only: v.optional(v.array(v.id("users"))),
};
type Scope = ObjectType<typeof scope>;

// Bounds on reads. A dev deployment holds a few hundred leagues and players.
const MAX_ROOTS = 2000;
/** Rows read from one index range in a single step. */
const PAGE = 500;
/** Deletions in one run, to stay inside a mutation's limits. A run that deletes anything schedules the next. */
const DELETES_PER_RUN = 1000;

async function fixtures(
  ctx: QueryCtx,
  { everything = false, keep = [], only }: Scope,
): Promise<{ leagues: Doc<"leagues">[]; players: Doc<"users">[] }> {
  if (only !== undefined) {
    const players = (await ctx.db.query("users").take(MAX_ROOTS)).filter(
      (user) => !user.isSeed && only.includes(user._id),
    );
    const leagues: Doc<"leagues">[] = [];
    for (const league of await ctx.db.query("leagues").take(MAX_ROOTS)) {
      if (SEEDED_LEAGUE_INVITE_CODES.includes(league.inviteCode)) continue;
      const members = await ctx.db
        .query("memberships")
        .withIndex("by_league", (q) => q.eq("leagueId", league._id))
        .take(PAGE);
      const theirs = members.length > 0 ? members.every((m) => only.includes(m.userId)) : only.includes(league.createdBy);
      if (theirs) leagues.push(league);
    }
    return { leagues, players };
  }

  // A real phone quick-matches into a public league or makes one of its own, and that league is
  // not a tester's to delete, whoever else is in it.
  const keptLeagueIds = new Set<Id<"leagues">>();
  for (const userId of keep) {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(PAGE);
    for (const membership of memberships) keptLeagueIds.add(membership.leagueId);
  }
  const isKept = (league: Doc<"leagues">) => keep.includes(league.createdBy) || keptLeagueIds.has(league._id);
  const leagues = (await ctx.db.query("leagues").take(MAX_ROOTS)).filter(
    (league) =>
      !SEEDED_LEAGUE_INVITE_CODES.includes(league.inviteCode) &&
      (isFixtureName(league.name) || (everything && !isKept(league))),
  );
  const players = (await ctx.db.query("users").take(MAX_ROOTS)).filter(
    (user) => !user.isSeed && !keep.includes(user._id) && (everything || isFixtureName(user.name)),
  );
  return { leagues, players };
}

/**
 * What `remove` would delete with the same arguments: the leagues and players, by name. An
 * account that never finished onboarding has no name. Deletes nothing.
 */
export const list = internalQuery({
  args: scope,
  returns: v.object({ leagues: v.array(v.string()), players: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const { leagues, players } = await fixtures(ctx, args);
    return {
      leagues: leagues.map((league) => league.name),
      players: players.map((player) => player.name ?? "(no name)"),
    };
  },
});

/**
 * Deletes every fixture league and player with all that hangs off them. Safe to run again at any
 * time: a league or player is deleted only after everything under it, so a run that stops early
 * leaves nothing dangling, and a run that finds no fixture deletes nothing.
 */
export const remove = internalMutation({
  args: scope,
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    const { leagues, players } = await fixtures(ctx, args);
    const sweep: Sweep = { ctx, left: DELETES_PER_RUN };

    // Leagues first: what is left of a fixture player afterwards is what they did in leagues that stay.
    for (const league of leagues) {
      if (sweep.left > 0) await removeLeague(sweep, league);
    }
    if (players.length > 0) {
      // Reactions and votes have no index by player, and both tables are small.
      const playerIds = new Set(players.map((player) => player._id));
      const reactions = await ctx.db.query("reactions").take(MAX_ROOTS);
      const votes = await ctx.db.query("votes").take(MAX_ROOTS);
      await clear(sweep, "reactions", reactions.filter((reaction) => playerIds.has(reaction.userId)));
      await clear(sweep, "votes", votes.filter((vote) => playerIds.has(vote.userId)));
    }
    for (const player of players) {
      if (sweep.left > 0) await removePlayer(sweep, player);
    }

    const deleted = DELETES_PER_RUN - sweep.left;
    if (deleted > 0) await ctx.scheduler.runAfter(0, internal.fixtures.remove, args);
    return { deleted };
  },
});

// ---- Deleting, children before the row they hang off ----------------------------------------------

/** One run's allowance of deletions, shared by every step. users.deleteAccount runs removePlayer with its own. */
export type Sweep = { ctx: MutationCtx; left: number };

/**
 * Deletes one page of rows. True when all of them went and the page was not full, which is when
 * the caller may delete the row these hung off.
 */
async function clear<Table extends TableNames>(
  sweep: Sweep,
  table: Table,
  rows: Doc<Table>[],
): Promise<boolean> {
  for (const row of rows) {
    if (sweep.left === 0) return false;
    await sweep.ctx.db.delete(table, row._id);
    sweep.left -= 1;
  }
  return rows.length < PAGE;
}

/** Removes each row with `removeOne`. True when every one went and the page was not full. */
async function clearEach<Row>(rows: Row[], removeOne: (row: Row) => Promise<boolean>): Promise<boolean> {
  for (const row of rows) {
    if (!(await removeOne(row))) return false;
  }
  return rows.length < PAGE;
}

// Each range below is read at the moment it is cleared, never ahead of time: clearing one range
// can delete rows of a later one (a drop takes its tasks, a task its proofs, a proof its challenges).

async function removeChallenge(sweep: Sweep, challenge: Doc<"challenges">): Promise<boolean> {
  const votes = await sweep.ctx.db
    .query("votes")
    .withIndex("by_challenge", (q) => q.eq("challengeId", challenge._id))
    .take(PAGE);
  return (await clear(sweep, "votes", votes)) && (await clear(sweep, "challenges", [challenge]));
}

async function removeProof(sweep: Sweep, proof: Doc<"proofs">): Promise<boolean> {
  const { db } = sweep.ctx;
  const reactions = await db
    .query("reactions")
    .withIndex("by_proof", (q) => q.eq("proofId", proof._id))
    .take(PAGE);
  const challenges = await db
    .query("challenges")
    .withIndex("by_proof", (q) => q.eq("proofId", proof._id))
    .take(PAGE);
  return (
    (await clear(sweep, "reactions", reactions)) &&
    (await clearEach(challenges, (challenge) => removeChallenge(sweep, challenge))) &&
    (await clear(sweep, "proofs", [proof]))
  );
}

async function removeTask(sweep: Sweep, task: Doc<"tasks">): Promise<boolean> {
  const { db } = sweep.ctx;
  const proofs = await db
    .query("proofs")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .take(PAGE);
  const arrivals = await db
    .query("arrivals")
    .withIndex("by_user_task", (q) => q.eq("userId", task.userId).eq("taskId", task._id))
    .take(PAGE);
  return (
    (await clearEach(proofs, (proof) => removeProof(sweep, proof))) &&
    (await clear(sweep, "arrivals", arrivals)) &&
    (await clear(sweep, "tasks", [task]))
  );
}

/** A drop with its RSVPs and the tasks it handed out, whoever they belong to. */
async function removeDrop(sweep: Sweep, drop: Doc<"drops">): Promise<boolean> {
  const { db } = sweep.ctx;
  const rsvps = await db
    .query("rsvps")
    .withIndex("by_drop", (q) => q.eq("dropId", drop._id))
    .take(PAGE);
  const tasks = await db
    .query("tasks")
    .withIndex("by_drop", (q) => q.eq("dropId", drop._id))
    .take(PAGE);
  return (
    (await clear(sweep, "rsvps", rsvps)) &&
    (await clearEach(tasks, (task) => removeTask(sweep, task))) &&
    (await clear(sweep, "drops", [drop]))
  );
}

const leagueWeeks = (sweep: Sweep, league: Doc<"leagues">["_id"]) =>
  sweep.ctx.db
    .query("weeks")
    .withIndex("by_league", (q) => q.eq("leagueId", league))
    .take(PAGE);

const weekMatchups = (sweep: Sweep, week: Doc<"weeks">) =>
  sweep.ctx.db
    .query("matchups")
    .withIndex("by_week", (q) => q.eq("weekId", week._id))
    .take(PAGE);

const leagueDrops = (sweep: Sweep, league: Doc<"leagues">["_id"]) =>
  sweep.ctx.db
    .query("drops")
    .withIndex("by_league_status", (q) => q.eq("leagueId", league))
    .take(PAGE);

const leagueChallenges = (sweep: Sweep, league: Doc<"leagues">["_id"]) =>
  sweep.ctx.db
    .query("challenges")
    .withIndex("by_league", (q) => q.eq("leagueId", league))
    .take(PAGE);

const leagueLedger = (sweep: Sweep, league: Doc<"leagues">["_id"]) =>
  sweep.ctx.db
    .query("ledger")
    .withIndex("by_league", (q) => q.eq("leagueId", league))
    .take(PAGE);

/** A member's invite link to a league, and the referrals into that league they made or came by. */
async function removeInvites(sweep: Sweep, { leagueId, userId }: Doc<"memberships">): Promise<boolean> {
  const { db } = sweep.ctx;
  const links = await db
    .query("inviteLinks")
    .withIndex("by_inviter_league", (q) => q.eq("inviterId", userId).eq("leagueId", leagueId))
    .take(PAGE);
  const made = await db
    .query("referrals")
    .withIndex("by_inviter", (q) => q.eq("inviterId", userId))
    .take(PAGE);
  const cameBy = await db
    .query("referrals")
    .withIndex("by_invitee", (q) => q.eq("inviteeId", userId))
    .take(PAGE);
  return (
    (await clear(sweep, "inviteLinks", links)) &&
    (await clear(
      sweep,
      "referrals",
      [...made, ...cameBy].filter((referral) => referral.leagueId === leagueId),
    ))
  );
}

/**
 * A league and everything keyed to it. Its members' own lineups, tasks and proofs stay: they
 * belong to the player and score in their other leagues too.
 */
async function removeLeague(sweep: Sweep, league: Doc<"leagues">): Promise<boolean> {
  const { db } = sweep.ctx;
  const leagueId = league._id;
  const weeks = await leagueWeeks(sweep, leagueId);
  const memberships = await db
    .query("memberships")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .take(PAGE);
  return (
    (await clearEach(weeks, async (week) => clear(sweep, "matchups", await weekMatchups(sweep, week)))) &&
    (await clearEach(memberships, (membership) => removeInvites(sweep, membership))) &&
    (await clearEach(await leagueDrops(sweep, leagueId), (drop) => removeDrop(sweep, drop))) &&
    (await clearEach(await leagueChallenges(sweep, leagueId), (challenge) => removeChallenge(sweep, challenge))) &&
    (await clear(sweep, "ledger", await leagueLedger(sweep, leagueId))) &&
    (await clear(
      sweep,
      "scores",
      await db
        .query("scores")
        .withIndex("by_league_week_user", (q) => q.eq("leagueId", leagueId))
        .take(PAGE),
    )) &&
    (await clear(
      sweep,
      "checkinMarks",
      await db
        .query("checkinMarks")
        .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId))
        .take(PAGE),
    )) &&
    (await clear(sweep, "memberships", memberships)) &&
    (await clear(sweep, "weeks", weeks)) &&
    (await clear(sweep, "leagues", [league]))
  );
}

/** What a fixture player left in a league that stays, and then their membership of it. */
async function leaveLeague(sweep: Sweep, membership: Doc<"memberships">): Promise<boolean> {
  const { db } = sweep.ctx;
  const { leagueId, userId } = membership;
  const removeTheirs = async (drop: Doc<"drops">) => {
    if (drop.createdBy === userId) return removeDrop(sweep, drop);
    const rsvps = await db
      .query("rsvps")
      .withIndex("by_drop", (q) => q.eq("dropId", drop._id))
      .take(PAGE);
    return clear(
      sweep,
      "rsvps",
      rsvps.filter((rsvp) => rsvp.userId === userId),
    );
  };
  return (
    (await clearEach(await leagueWeeks(sweep, leagueId), async (week) =>
      clear(
        sweep,
        "matchups",
        (await weekMatchups(sweep, week)).filter((matchup) => matchup.userA === userId || matchup.userB === userId),
      ),
    )) &&
    (await clearEach(await leagueDrops(sweep, leagueId), removeTheirs)) &&
    (await removeInvites(sweep, membership)) &&
    (await clearEach(
      (await leagueChallenges(sweep, leagueId)).filter((challenge) => challenge.challengerId === userId),
      (challenge) => removeChallenge(sweep, challenge),
    )) &&
    (await clear(
      sweep,
      "ledger",
      (await leagueLedger(sweep, leagueId)).filter((row) => row.userId === userId),
    )) &&
    (await clear(
      sweep,
      "checkinMarks",
      await db
        .query("checkinMarks")
        .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", userId))
        .take(PAGE),
    )) &&
    (await clear(sweep, "memberships", [membership]))
  );
}

/** A player, their week-by-week rows, their sign-in, and what they left in leagues that stay. */
export async function removePlayer(sweep: Sweep, player: Doc<"users">): Promise<boolean> {
  const { db } = sweep.ctx;
  const userId = player._id;
  const removeSession = async (session: Doc<"authSessions">) => {
    const tokens = await db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .take(PAGE);
    return (await clear(sweep, "authRefreshTokens", tokens)) && (await clear(sweep, "authSessions", [session]));
  };
  const removeAccount = async (account: Doc<"authAccounts">) => {
    const codes = await db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .take(PAGE);
    return (await clear(sweep, "authVerificationCodes", codes)) && (await clear(sweep, "authAccounts", [account]));
  };
  return (
    (await clearEach(
      await db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(PAGE),
      (membership) => leaveLeague(sweep, membership),
    )) &&
    (await clearEach(
      await db
        .query("tasks")
        .withIndex("by_user_week", (q) => q.eq("userId", userId))
        .take(PAGE),
      (task) => removeTask(sweep, task),
    )) &&
    (await clearEach(
      await db
        .query("proofs")
        .withIndex("by_user_week", (q) => q.eq("userId", userId))
        .take(PAGE),
      (proof) => removeProof(sweep, proof),
    )) &&
    (await clear(
      sweep,
      "lineups",
      await db
        .query("lineups")
        .withIndex("by_user_week", (q) => q.eq("userId", userId))
        .take(PAGE),
    )) &&
    (await clear(
      sweep,
      "scores",
      await db
        .query("scores")
        .withIndex("by_user_week", (q) => q.eq("userId", userId))
        .take(PAGE),
    )) &&
    (await clear(
      sweep,
      "checkinNudges",
      await db
        .query("checkinNudges")
        .withIndex("by_user_day", (q) => q.eq("userId", userId))
        .take(PAGE),
    )) &&
    (await clear(
      sweep,
      "arrivals",
      await db
        .query("arrivals")
        .withIndex("by_user_task", (q) => q.eq("userId", userId))
        .take(PAGE),
    )) &&
    (await clear(
      sweep,
      "canvasConnections",
      await db
        .query("canvasConnections")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(PAGE),
    )) &&
    (await clear(
      sweep,
      "pushTokens",
      await db
        .query("pushTokens")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(PAGE),
    )) &&
    (await clear(
      sweep,
      "inviteLinks",
      await db
        .query("inviteLinks")
        .withIndex("by_inviter_league", (q) => q.eq("inviterId", userId))
        .take(PAGE),
    )) &&
    (await clear(
      sweep,
      "referrals",
      await db
        .query("referrals")
        .withIndex("by_inviter", (q) => q.eq("inviterId", userId))
        .take(PAGE),
    )) &&
    (await clear(
      sweep,
      "referrals",
      await db
        .query("referrals")
        .withIndex("by_invitee", (q) => q.eq("inviteeId", userId))
        .take(PAGE),
    )) &&
    (await clearEach(
      await db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .take(PAGE),
      removeSession,
    )) &&
    (await clearEach(
      await db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .take(PAGE),
      removeAccount,
    )) &&
    (await clear(sweep, "users", [player]))
  );
}
