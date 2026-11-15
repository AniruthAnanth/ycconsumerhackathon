/**
 * League standings, the head-to-head matchup and the pot.
 *
 * Nothing here is stored. Every number is recomputed from tasks, proofs, challenges and ledger
 * rows each time a query runs, so a second phone reorders the moment a proof is written and the
 * table can never drift from the rows it summarises.
 *
 * A league's "current week" is its latest weeks row (see currentWeek in leagues.ts). A player's
 * tasks and proofs are keyed by (userId, weekStart) and count in every league they belong to,
 * except a task that carries a dropId, which counts only in that drop's league.
 */
import type { FunctionReturnType } from "convex/server";
import { ConvexError, v } from "convex/values";

import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { challengerPointsByUser } from "./challenges";
import { currentWeek, membersInJoinOrder, paidInto } from "./leagues";
import { requireUser } from "./lib/auth";
import { withoutStandIns } from "./lib/schedule";
import { CORE_SLOTS, currentStreak, matchupBonus, scoreWeek, winProbability, type Slot } from "./lib/scoring";
import { pacificDay } from "./lib/week";

type ReadCtx = QueryCtx | MutationCtx;

// Bounds on single reads. Each is far above what one player or league produces in a week.
const TASKS_PER_WEEK = 100;
const PROOFS_PER_WEEK = 500;
const MATCHUPS_PER_WEEK = 50;
const WEEKS_PER_LEAGUE = 200;
const LEDGER_ROWS = 1000;

const UNNAMED_PLAYER = "Player";

/** One member's line in a league week, before it is shaped for a screen. */
export type MemberStanding = {
  userId: Id<"users">;
  name: string;
  avatarStorageId?: Id<"_storage">;
  paid: boolean;
  /** Everything the member has scored in this league this week. */
  points: number;
  slotsCleared: number;
  /** Cleared all five slots, which is what keeps the stake at settlement. */
  finisher: boolean;
  streak: number;
  /** Points still sitting in unfinished tasks. The win probability projects from them. */
  openPoints: number;
};

async function leagueAndWeek(
  ctx: ReadCtx,
  leagueId: Id<"leagues">,
  weekId?: Id<"weeks">,
): Promise<{ league: Doc<"leagues">; week: Doc<"weeks"> }> {
  const league = await ctx.db.get("leagues", leagueId);
  if (league === null) {
    throw new ConvexError("League not found");
  }
  const week = weekId === undefined ? await currentWeek(ctx, leagueId) : await ctx.db.get("weeks", weekId);
  if (week === null || week.leagueId !== leagueId) {
    throw new ConvexError("This league has not started its first week");
  }
  return { league, week };
}

// A league's numbers are for its members, as everywhere else ("you share a league with the player").
async function isMember(ctx: ReadCtx, leagueId: Id<"leagues">, userId: Id<"users">): Promise<boolean> {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", userId))
    .unique();
  return membership !== null;
}

async function weekMatchups(ctx: ReadCtx, weekId: Id<"weeks">): Promise<Doc<"matchups">[]> {
  return await ctx.db
    .query("matchups")
    .withIndex("by_week", (q) => q.eq("weekId", weekId))
    .take(MATCHUPS_PER_WEEK);
}

/**
 * A player's tasks for the week that count in this league: all of them, except tasks from
 * another league's drop. `dropLeagues` remembers each drop's league across players.
 */
async function tasksCountingIn(
  ctx: ReadCtx,
  leagueId: Id<"leagues">,
  userId: Id<"users">,
  weekStart: number,
  dropLeagues: Map<Id<"drops">, Id<"leagues"> | null>,
): Promise<Doc<"tasks">[]> {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", weekStart))
    .take(TASKS_PER_WEEK);
  const counting: Doc<"tasks">[] = [];
  for (const task of tasks) {
    if (task.dropId !== undefined) {
      if (!dropLeagues.has(task.dropId)) {
        dropLeagues.set(task.dropId, (await ctx.db.get("drops", task.dropId))?.leagueId ?? null);
      }
      if (dropLeagues.get(task.dropId) !== leagueId) continue;
    }
    counting.push(task);
  }
  return counting;
}

/**
 * The Pacific days on which the player had a verified proof. A proof counts only while its task
 * is verified, so a proof under challenge (task held) or overturned (task reopened) drops out of
 * the streak together with its points.
 */
async function proofDays(
  ctx: ReadCtx,
  userId: Id<"users">,
  weekStart: number,
  tasks: Doc<"tasks">[],
): Promise<number[]> {
  const verified = new Set(tasks.filter((task) => task.status === "verified").map((task) => task._id));
  const proofs = await ctx.db
    .query("proofs")
    .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", weekStart))
    .take(PROOFS_PER_WEEK);
  return proofs.filter((proof) => proof.pass && verified.has(proof.taskId)).map((proof) => pacificDay(proof.createdAt));
}

/**
 * Every member's standing for one league week, best first. This is the single source of the
 * numbers on the League tab, the Matchup tab, texted standings and settlement, so other modules
 * call it instead of adding points up themselves.
 *
 * `weekId` defaults to the league's current week. The matchup bonus exists only once a week has
 * settled; `atSettlement` adds it to a week that is about to, so the pot is split on final points.
 */
export async function leagueStandings(
  ctx: ReadCtx,
  leagueId: Id<"leagues">,
  weekId?: Id<"weeks">,
  options: { atSettlement?: boolean } = {},
): Promise<MemberStanding[]> {
  const { league, week } = await leagueAndWeek(ctx, leagueId, weekId);
  const hasPaid = await paidInto(ctx, league, week);
  const challengerPoints = await challengerPointsByUser(ctx, leagueId, { from: week.startsAt, to: week.endsAt });
  const dropLeagues = new Map<Id<"drops">, Id<"leagues"> | null>();

  const members: (Omit<MemberStanding, "streak"> & { days: number[] })[] = [];
  for (const membership of await membersInJoinOrder(ctx, leagueId)) {
    const userId = membership.userId;
    const user = await ctx.db.get("users", userId);
    const tasks = await tasksCountingIn(ctx, leagueId, userId, week.startsAt, dropLeagues);
    const days = await proofDays(ctx, userId, week.startsAt, tasks);
    const score = scoreWeek(tasks, days);
    members.push({
      userId,
      name: user?.name ?? UNNAMED_PLAYER,
      ...(user?.avatarStorageId && { avatarStorageId: user.avatarStorageId }),
      paid: hasPaid(userId),
      points: score.total + (challengerPoints.get(userId) ?? 0),
      slotsCleared: score.slotsCleared,
      finisher: score.finisher,
      openPoints: tasks
        .filter((task) => task.status === "open" || task.status === "held")
        .reduce((sum, task) => sum + task.points, 0),
      days,
    });
  }

  if (week.status === "settled" || options.atSettlement) {
    // Both sides of every pair are compared on their points before any bonus lands.
    const before = new Map(members.map((member) => [member.userId, member.points]));
    // A member with the week off has a stand-in row so their Matchup tab is not empty. It is not a
    // head-to-head, and counting it would pay the member it borrows a second bonus.
    const played = withoutStandIns(
      (await weekMatchups(ctx, week._id)).map(({ userA, userB }) => ({ a: userA, b: userB })),
    );
    for (const { a: userA, b: userB } of played) {
      const a = before.get(userA);
      const b = before.get(userB);
      if (a === undefined || b === undefined) continue;
      for (const member of members) {
        if (member.userId === userA) member.points += matchupBonus(a, b);
        if (member.userId === userB) member.points += matchupBonus(b, a);
      }
    }
  }

  // A query can't read the clock, so "today" for streaks is the day of the league's latest proof.
  const today = Math.max(...members.flatMap((member) => member.days));
  return members
    .map(({ days, ...member }) => ({ ...member, streak: currentStreak(days, today) }))
    .sort((a, b) => b.points - a.points || b.slotsCleared - a.slotsCleared || a.name.localeCompare(b.name));
}

/** One member's points in a league week: the number the table and the matchup show. */
export async function pointsInLeague(
  ctx: ReadCtx,
  leagueId: Id<"leagues">,
  userId: Id<"users">,
  weekId?: Id<"weeks">,
): Promise<number> {
  const standings = await leagueStandings(ctx, leagueId, weekId);
  return standings.find((standing) => standing.userId === userId)?.points ?? 0;
}

const tableRow = v.object({
  rank: v.number(),
  userId: v.id("users"),
  name: v.string(),
  avatarUrl: v.optional(v.string()),
  slotsCleared: v.number(),
  points: v.number(),
  streak: v.number(),
  paid: v.boolean(),
});

async function toTable(ctx: QueryCtx, standings: MemberStanding[]) {
  const rows = [];
  for (const [index, standing] of standings.entries()) {
    const avatarUrl = standing.avatarStorageId ? await ctx.storage.getUrl(standing.avatarStorageId) : null;
    rows.push({
      rank: index + 1,
      userId: standing.userId,
      name: standing.name,
      ...(avatarUrl !== null && { avatarUrl }),
      slotsCleared: standing.slotsCleared,
      points: standing.points,
      streak: standing.streak,
      paid: standing.paid,
    });
  }
  return rows;
}

export const table = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(tableRow),
  handler: async (ctx, args) => {
    // An empty table, not an error, for a non-member: seed.reset removes a guest while their phone
    // still asks about the league, and a throw there would crash the screen.
    const caller = await requireUser(ctx);
    if (!(await isMember(ctx, args.leagueId, caller._id))) return [];
    return await toTable(ctx, await leagueStandings(ctx, args.leagueId));
  },
});

/**
 * The same rows as `table` for callers with no signed-in player: a texted STANDINGS command and
 * settlement. `weekStart` picks an earlier week of the league.
 */
export const tableForLeague = internalQuery({
  args: {
    leagueId: v.id("leagues"),
    weekStart: v.optional(v.number()),
    atSettlement: v.optional(v.boolean()),
  },
  returns: v.array(tableRow),
  handler: async (ctx, args) => {
    let weekId: Id<"weeks"> | undefined;
    if (args.weekStart !== undefined) {
      const weeks = await ctx.db
        .query("weeks")
        .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
        .take(WEEKS_PER_LEAGUE);
      weekId = weeks.find((week) => week.startsAt === args.weekStart)?._id;
      if (weekId === undefined) {
        throw new ConvexError("This league has no week starting then");
      }
    }
    const standings = await leagueStandings(ctx, args.leagueId, weekId, { atSettlement: args.atSettlement });
    return await toTable(ctx, standings);
  },
});

type TaskRow = FunctionReturnType<typeof api.lineup.roster>["rows"][number];
type Side = { userId: Id<"users">; name: string; total: number; winProbability: number; slotsCleared: number };
type MatchupRow = { slot: Slot; mine?: TaskRow; theirs?: TaskRow };

/**
 * Lines two rosters up the way the Matchup tab shows them: one row per roster slot with each
 * side's drafted task, then the rest (flex, drop, mystery and group tasks) side by side in
 * roster order under the flex label.
 */
function pairRows(mine: TaskRow[], theirs: TaskRow[]): MatchupRow[] {
  const starter = (rows: TaskRow[], slot: Slot) => rows.find((row) => row.slot === slot && row.source === "draft");
  const row = (slot: Slot, left?: TaskRow, right?: TaskRow): MatchupRow => ({
    slot,
    ...(left && { mine: left }),
    ...(right && { theirs: right }),
  });

  const rows = CORE_SLOTS.map((slot) => row(slot, starter(mine, slot), starter(theirs, slot)));
  const starters = new Set(rows.flatMap((paired) => [paired.mine, paired.theirs]));
  const myBench = mine.filter((task) => !starters.has(task));
  const theirBench = theirs.filter((task) => !starters.has(task));
  for (let i = 0; i < Math.max(myBench.length, theirBench.length); i++) {
    rows.push(row("flex", myBench[i], theirBench[i]));
  }
  return rows;
}

/** The caller's head-to-head this week. Null when they have no opponent: a one-member league, or a league they aren't in. */
export const matchup = query({
  args: { leagueId: v.id("leagues") },
  handler: async (ctx, args): Promise<{ me: Side; opponent: Side; rows: MatchupRow[] } | null> => {
    const caller = await requireUser(ctx);
    const { week } = await leagueAndWeek(ctx, args.leagueId);

    // In an odd league one member sits in two pairs. Their own matchup is the first; the extra
    // pair that gives the left-over member an opponent is always the last row.
    const pairs = await weekMatchups(ctx, week._id);
    const pair = pairs.find((candidate) => candidate.userA === caller._id || candidate.userB === caller._id);
    if (pair === undefined) return null;
    const opponentId = pair.userA === caller._id ? pair.userB : pair.userA;

    const standings = await leagueStandings(ctx, args.leagueId, week._id);
    const mine = standings.find((standing) => standing.userId === caller._id);
    const theirs = standings.find((standing) => standing.userId === opponentId);
    if (mine === undefined || theirs === undefined) return null;

    // lineup.roster owns what a roster row looks like (thumbnail, due label, score), so both
    // columns come from it and can't disagree with the Roster tab.
    const rosterOf = (userId: Id<"users">) =>
      ctx.runQuery(api.lineup.roster, { leagueId: args.leagueId, userId, weekStart: week.startsAt });
    const myRoster = await rosterOf(caller._id);
    const theirRoster = await rosterOf(opponentId);

    const myChance = winProbability(
      { total: mine.points, openPoints: mine.openPoints },
      { total: theirs.points, openPoints: theirs.openPoints },
    );
    return {
      me: { userId: mine.userId, name: mine.name, total: mine.points, winProbability: myChance, slotsCleared: mine.slotsCleared },
      // Derived from mine, so the two sides always add up to exactly 1.
      opponent: {
        userId: theirs.userId,
        name: theirs.name,
        total: theirs.points,
        winProbability: Math.round((1 - myChance) * 100) / 100,
        slotsCleared: theirs.slotsCleared,
      },
      rows: pairRows(myRoster.rows, theirRoster.rows),
    };
  },
});

const person = v.object({ userId: v.id("users"), name: v.string() });

/**
 * The week's pot. The amount is the sum of the week's buy_in ledger rows, so it ticks up on every
 * phone the moment a payment's row is written. Payouts appear once the week has settled and are
 * that week's refund and winnings rows; the fee row is not a payout.
 */
export const pot = query({
  args: { leagueId: v.id("leagues") },
  returns: v.object({
    stakeUsd: v.number(),
    potUsd: v.number(),
    paid: v.array(person),
    unpaid: v.array(person),
    settlesAt: v.number(),
    payouts: v.optional(
      v.array(
        v.object({
          userId: v.id("users"),
          name: v.string(),
          kind: v.union(v.literal("refund"), v.literal("winnings")),
          amountUsd: v.number(),
          // Present once Whop has accepted the money movement, so a screen can show it was sent.
          whopId: v.optional(v.string()),
        }),
      ),
    ),
  }),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx);
    const { league, week } = await leagueAndWeek(ctx, args.leagueId);
    if (!(await isMember(ctx, league._id, caller._id))) {
      return { stakeUsd: league.stakeUsd, potUsd: 0, paid: [], unpaid: [], settlesAt: week.endsAt };
    }

    const names = new Map<Id<"users">, string>();
    const nameOf = async (userId: Id<"users">) => {
      if (!names.has(userId)) {
        names.set(userId, (await ctx.db.get("users", userId))?.name ?? UNNAMED_PLAYER);
      }
      return names.get(userId) ?? UNNAMED_PLAYER;
    };

    const hasPaid = await paidInto(ctx, league, week);
    const paid: { userId: Id<"users">; name: string }[] = [];
    const unpaid: { userId: Id<"users">; name: string }[] = [];
    for (const membership of await membersInJoinOrder(ctx, league._id)) {
      const member = { userId: membership.userId, name: await nameOf(membership.userId) };
      (hasPaid(membership.userId) ? paid : unpaid).push(member);
    }

    // A ledger row names its week, so it was written after that week's own row. Starting the read
    // there skips every earlier week however long the season has run. What is left is this week's
    // rows and any payout of an earlier week that landed late, which the loop below passes over.
    const ledger = await ctx.db
      .query("ledger")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id).gte("_creationTime", week._creationTime))
      .take(LEDGER_ROWS);
    let potCents = 0;
    const payouts: {
      userId: Id<"users">;
      name: string;
      kind: "refund" | "winnings";
      amountUsd: number;
      whopId?: string;
    }[] = [];
    for (const row of ledger) {
      if (row.weekId !== week._id) continue;
      if (row.kind === "buy_in") {
        potCents += Math.round(row.amountUsd * 100);
      } else if (row.kind !== "fee" && row.userId !== undefined) {
        payouts.push({
          userId: row.userId,
          name: await nameOf(row.userId),
          kind: row.kind,
          amountUsd: row.amountUsd,
          ...(row.whopId !== undefined && { whopId: row.whopId }),
        });
      }
    }
    payouts.sort((a, b) => b.amountUsd - a.amountUsd);

    return {
      stakeUsd: league.stakeUsd,
      potUsd: potCents / 100,
      paid,
      unpaid,
      settlesAt: week.endsAt,
      ...(week.status === "settled" && { payouts }),
    };
  },
});
