/**
 * Leaderboards: every ranking the app shows, and the earnings projection.
 *
 * Where the numbers come from:
 *   - The week in play is tallied live from tasks and proofs with the same
 *     scoring functions as the standings, so a board reorders the moment a
 *     proof is written and can never disagree with the League tab. A settled
 *     week adds the matchup bonus exactly as the standings do (leagueWeek).
 *   - Finished weeks are read from `scores`, one stored row per player per
 *     league per week, so "season" and "all-time" never re-read old proofs.
 *     The stored rows are written by the same leagueWeek, bonus included.
 *   - The global boards rank across every league straight off an index on
 *     `scores`.
 *
 * `refresh` keeps `scores` current: whatever verifies a proof schedules it.
 * `sync` rebuilds a whole league when the Leaderboards screen opens, as a net
 * under any writer that forgot.
 *
 * Every read goes through an index, never a table scan; the comment beside
 * each read names the index. What a row says ("15 behind Maya", the rival) is
 * decided in lib/ranking.ts, and the payout maths in lib/projection.ts.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { challengerPointsByUser } from "./challenges";
import { membersInJoinOrder, membershipOf } from "./leagues";
import { requireUser } from "./lib/auth";
import { UNNAMED_PLAYER } from "./lib/names";
import { projectionLabel, projectPayout, settledLabel, type Projection, type ProjectionMember } from "./lib/projection";
import { FORMATS, rankBoard, type BoardFormat, type Entry } from "./lib/ranking";
import { resolveSettings, seasonOf, seasonTable, withoutStandIns, type Result } from "./lib/schedule";
import { CORE_SLOTS, matchupBonus, type CoreSlot } from "./lib/scoring";
import { computeVersusSettlement } from "./lib/versusSettlement";
import { DAY_MS, pacificDay, startOfPacificDay } from "./lib/week";
import { NO_STATS, tallyWeek, totalStats, type ScoreStats, type WeekFacts, type WeekTally } from "./lib/weekTally";
import { entrantsOver } from "./whop";
import { syncRanks, type Metric } from "./boardRanks";
import { recruiterTally } from "./referrals";

type UserId = Id<"users">;
/** The reads below work the same from a query and from a mutation. */
type ReadCtx = Pick<QueryCtx, "db" | "storage">;

/** leagues.maxMembers keeps a league far below this; it only bounds the reads. */
const MAX_MEMBERS = 100;
/** More than a year of weekly play. Older weeks drop off the boards. */
const MAX_WEEKS = 60;
const MAX_WEEK_TASKS = 60;
const MAX_WEEK_PROOFS = 200;
const MAX_STORED_ROWS = 4000;
const MAX_LEDGER_ROWS = 4000;
const MAX_LEAGUES_PER_PLAYER = 50;
/** The global board shows this many players; it reads more rows because a player has one per league. */
const GLOBAL_PLAYERS = 50;
const GLOBAL_ROWS = 300;
/** Projecting everyone's payout enumerates scenarios per member; fine for a league of friends. */
const MAX_PROJECTED_MEMBERS = 12;

/** weekStart of the row that holds a player's all-time total in a league. Real weeks are far above it. */
const ALL_TIME = 0;
/** The first weekStart that is a real week: a range from here skips the stored all-time row. */
const FIRST_WEEK = ALL_TIME + 1;

// ---- The boards -------------------------------------------------------------------------------

const boardKey = v.union(
  v.literal("week"),
  v.literal("season"),
  v.literal("allTime"),
  v.literal("global"),
  v.literal("globalAllTime"),
  v.literal("body"),
  v.literal("mind"),
  v.literal("recharge"),
  v.literal("chores"),
  v.literal("people"),
  v.literal("streak"),
  v.literal("highlights"),
  v.literal("quickTime"),
  v.literal("headToHead"),
  v.literal("money"),
  v.literal("recruiters"),
);
type BoardKey = typeof boardKey.type;

/** A board that ranks the league's members by one number out of their stats. */
type StatBoard = {
  title: string;
  valueHeader: string;
  format: BoardFormat;
  /** How far back it looks. */
  span: "week" | "season" | "allTime";
  /**
   * The ranked tree (boardRanks.ts) that holds an all-time board's order. Such
   * a board reads the stored all-time rows; the week and season boards add up
   * the week in play live instead, so they agree with the League tab the
   * moment a proof lands.
   */
  metric?: Metric;
  /** The number it ranks by. Undefined keeps a player off the board. */
  value: (stats: ScoreStats) => number | undefined;
  /** The grey line under the name. */
  detail?: (ctx: ReadCtx, total: ScoreStats, thisWeek: ScoreStats) => Promise<string | undefined> | string | undefined;
};

const thisWeek = (points: number) => `${points < 0 ? "" : "+"}${points} this week`;

function slotBoard(slot: CoreSlot, title: string): StatBoard {
  return {
    title,
    valueHeader: "PTS",
    format: FORMATS.points,
    span: "allTime",
    metric: slot,
    value: (stats) => stats.slotPoints[slot],
    detail: (_ctx, _total, week) => thisWeek(week.slotPoints[slot]),
  };
}

const STAT_BOARDS: Record<Exclude<BoardKey, "global" | "globalAllTime" | "headToHead" | "money" | "recruiters">, StatBoard> = {
  week: {
    title: "This Week",
    valueHeader: "PTS",
    format: FORMATS.points,
    span: "week",
    value: (stats) => stats.points,
    detail: (_ctx, total) => `${total.slotsCleared}/${CORE_SLOTS.length} slots`,
  },
  season: {
    title: "Season",
    valueHeader: "PTS",
    format: FORMATS.points,
    span: "season",
    value: (stats) => stats.points,
    detail: (_ctx, _total, week) => thisWeek(week.points),
  },
  allTime: {
    title: "All-Time",
    valueHeader: "PTS",
    format: FORMATS.points,
    span: "allTime",
    metric: "points",
    value: (stats) => stats.points,
    detail: (_ctx, total) => `${total.tasksVerified} ${total.tasksVerified === 1 ? "task" : "tasks"} proved`,
  },
  body: slotBoard("body", "Best Body"),
  mind: slotBoard("mind", "Best Mind"),
  recharge: slotBoard("recharge", "Best Recharge"),
  chores: slotBoard("chores", "Best Chores"),
  people: slotBoard("people", "Best People"),
  streak: {
    title: "Longest Streak",
    valueHeader: "DAYS",
    format: FORMATS.days,
    span: "allTime",
    metric: "streak",
    value: (stats) => stats.streak,
    detail: (_ctx, _total, week) => (week.streak >= 2 ? `${week.streak} in a row this week` : undefined),
  },
  highlights: {
    title: "Best Proofs",
    valueHeader: "SCORE",
    format: FORMATS.highlight,
    span: "allTime",
    metric: "highlight",
    // Nobody is ranked for a proof they have not made.
    value: (stats) => (stats.bestHighlight > 0 ? stats.bestHighlight : undefined),
    detail: async (ctx, total) =>
      total.bestProofId === undefined ? undefined : (await ctx.db.get("proofs", total.bestProofId))?.caption,
  },
  quickTime: {
    title: "Fastest Quick-Time",
    valueHeader: "TIME",
    format: FORMATS.seconds,
    span: "allTime",
    metric: "quickTime",
    value: (stats) => stats.fastestQuickTimeSec,
  },
};

const OTHER_BOARDS = {
  global: { title: "Global", valueHeader: "PTS", format: FORMATS.points },
  globalAllTime: { title: "Global All-Time", valueHeader: "PTS", format: FORMATS.points },
  headToHead: { title: "Head-to-Head", valueHeader: "W-L", format: FORMATS.wins },
  money: { title: "Money", valueHeader: "NET", format: FORMATS.money },
  recruiters: { title: "Recruiters", valueHeader: "PTS", format: FORMATS.points },
} satisfies Record<string, { title: string; valueHeader: string; format: BoardFormat }>;

const boardRow = v.object({
  rank: v.number(),
  userId: v.id("users"),
  name: v.string(),
  avatarUrl: v.optional(v.string()),
  value: v.number(),
  valueLabel: v.string(),
  detail: v.optional(v.string()),
  movement: v.number(),
  gapLabel: v.optional(v.string()),
  isMe: v.boolean(),
  isRival: v.boolean(),
});

/**
 * One leaderboard for a league, best first. Each row carries its place, the
 * places moved since yesterday and the gap to the player above; `rival` names
 * the caller's closest neighbour. A league's boards are for its members: they
 * name people and what each has won. Anyone signed in may read the two global
 * boards, which are public by design.
 */
export const board = query({
  // `at` is the caller's clock, rounded to the hour so the query is not rerun every second. Only
  // the money board reads it, to project a stake in play as leaderboards.projection does.
  args: { leagueId: v.id("leagues"), board: boardKey, at: v.optional(v.number()) },
  returns: v.object({
    board: boardKey,
    title: v.string(),
    valueHeader: v.string(),
    rows: v.array(boardRow),
    rival: v.optional(v.object({ userId: v.id("users"), name: v.string(), label: v.string() })),
  }),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const league = await loadLeague(ctx, args.leagueId);
    const { title, valueHeader, format } = { ...STAT_BOARDS, ...OTHER_BOARDS }[args.board];
    const open = args.board === "global" || args.board === "globalAllTime";
    const allowed = league !== null && (open || league.members.some((member) => member.userId === me._id));
    const entries = allowed ? await entriesFor(ctx, league, args.board, args.at) : [];
    // The League tab's table numbers level players straight through (6, 7, 8, by name). This Week
    // is that table, and the strip above it quotes its place, so it numbers them the same way.
    const splitTies = args.board === "week";
    return { board: args.board, title, valueHeader, ...rankBoard(entries, format, me._id, { splitTies }) };
  },
});

async function entriesFor(ctx: QueryCtx, league: League, key: BoardKey, at?: number): Promise<Entry<UserId>[]> {
  if (league.current === null) return [];
  switch (key) {
    case "global":
      return await globalEntries(ctx, league.current.startsAt);
    case "globalAllTime":
      return await globalEntries(ctx, ALL_TIME);
    case "headToHead":
      return await headToHeadEntries(ctx, league);
    case "money":
      return await moneyEntries(ctx, league, at);
    case "recruiters":
      return await recruiterEntries(ctx, league);
    default: {
      const spec = STAT_BOARDS[key];
      return spec.metric === undefined ? await statEntries(ctx, league, spec) : await rankedEntries(ctx, league, spec);
    }
  }
}

/**
 * An all-time board read off the league's stored all-time rows, with no tasks
 * or proofs re-read. The week in play is in those rows as of the last refresh,
 * which every scoring write schedules. rankBoard orders them; the ranked tree
 * for `spec.metric` (boardRanks.ts) holds the same order for when a league is
 * too big to sort, but for a league of friends one index range read is faster
 * than a component call.
 */
async function rankedEntries(ctx: ReadCtx, league: League, spec: StatBoard): Promise<Entry<UserId>[]> {
  const leagueId = league.doc._id;
  const [rows, inPlay] = await Promise.all([
    // scores.by_league_week_user over the all-time rows: one per member.
    ctx.db
      .query("scores")
      .withIndex("by_league_week_user", (q) => q.eq("leagueId", leagueId).eq("weekStart", ALL_TIME))
      .take(MAX_MEMBERS),
    // scores.by_league_week_user over the week in play: the "this week" detail.
    ctx.db
      .query("scores")
      .withIndex("by_league_week_user", (q) => q.eq("leagueId", leagueId).eq("weekStart", league.current!.startsAt))
      .take(MAX_MEMBERS),
  ]);
  const members = new Map(league.members.map((member) => [member.userId, member]));
  const thisWeekOf = new Map(inPlay.map((row) => [row.userId, row.now]));
  // A row last rebuilt before the newest day on the board did not move during it.
  const newestDay = Math.max(0, ...rows.map((row) => row.day));
  const entries: Entry<UserId>[] = [];
  for (const row of rows) {
    const member = members.get(row.userId);
    const value = spec.value(row.now);
    if (member === undefined || value === undefined) continue;
    const detail = await spec.detail?.(ctx, row.now, thisWeekOf.get(row.userId) ?? NO_STATS);
    entries.push({
      ...identity(member),
      value,
      previous: row.day === newestDay ? (spec.value(row.yesterday) ?? null) : value,
      tiebreak: row.now.slotsCleared,
      ...(detail ? { detail } : {}),
    });
  }
  return entries;
}

async function statEntries(ctx: ReadCtx, league: League, spec: StatBoard): Promise<Entry<UserId>[]> {
  const from = { week: league.current!.startsAt, season: seasonStart(league), allTime: FIRST_WEEK }[spec.span];
  const weeks = await history(ctx, league, from);
  const entries: Entry<UserId>[] = [];
  for (const member of league.members) {
    const views = weeks.get(member.userId) ?? [];
    const now = totalStats(views.map((view) => ({ weekStart: view.weekStart, ...view.now })));
    const value = spec.value(now);
    if (value === undefined) continue;
    const yesterday = totalStats(views.map((view) => ({ weekStart: view.weekStart, ...view.yesterday })));
    const detail = await spec.detail?.(ctx, now, weekInPlay(views, league)?.now.stats ?? NO_STATS);
    entries.push({
      ...identity(member),
      value,
      previous: spec.value(yesterday) ?? null,
      // As in the standings table: level players are split by slots cleared.
      tiebreak: now.slotsCleared,
      ...(detail ? { detail } : {}),
    });
  }
  return entries;
}

/**
 * Head-to-head records: wins and losses over the finished weeks, level records
 * split by points scored, with the matchup in play as each player's detail.
 */
async function headToHeadEntries(ctx: ReadCtx, league: League): Promise<Entry<UserId>[]> {
  const current = league.current!;
  const weeks = await history(ctx, league, FIRST_WEEK);
  const pointsIn = (userId: UserId, weekStart: number) =>
    weeks.get(userId)?.find((view) => view.weekStart === weekStart)?.now.stats.points ?? 0;
  const nameOf = new Map(league.members.map((member) => [member.userId, member.name]));

  const results: Result<UserId>[] = [];
  const inPlay = new Map<UserId, { line: string; points: number }>();
  for (const week of league.weeks) {
    // matchups.by_week: one range read per league week.
    const pairs = await ctx.db
      .query("matchups")
      .withIndex("by_week", (q) => q.eq("weekId", week._id))
      .take(MAX_MEMBERS);
    const live = week._id === current._id && week.status === "open";
    // A member with the week off has a stand-in row so their Matchup tab is not empty. It is not a game.
    for (const pair of withoutStandIns(pairs.map((row) => ({ ...row, a: row.userA, b: row.userB })))) {
      // A finished week's score is frozen on the matchup; older weeks fall back to the stored rows.
      const scoreA = pair.scoreA ?? pointsIn(pair.userA, week.startsAt);
      const scoreB = pair.scoreB ?? pointsIn(pair.userB, week.startsAt);
      results.push({ a: pair.userA, b: pair.userB, week: week.number, scoreA, scoreB, live });
      if (!live) continue;
      inPlay.set(pair.userA, { line: versus(nameOf.get(pair.userB), scoreA, scoreB), points: scoreA });
      inPlay.set(pair.userB, { line: versus(nameOf.get(pair.userA), scoreB, scoreA), points: scoreB });
    }
  }

  const members = new Map(league.members.map((member) => [member.userId, member]));
  return seasonTable([...members.keys()], results).map((row) => {
    const playing = inPlay.get(row.id);
    return {
      ...identity(members.get(row.id)!),
      value: row.wins,
      // A record only moves when a week ends, so it stood yesterday as it stands now.
      previous: row.wins,
      // Points this week count too, so the board is alive before the first week is decided.
      tiebreak: row.pointsFor + (playing?.points ?? 0),
      valueLabel: [row.wins, row.losses, ...(row.ties > 0 ? [row.ties] : [])].join("-"),
      ...(playing === undefined ? {} : { detail: playing.line }),
    };
  });
}

function versus(opponent: string | undefined, mine: number, theirs: number): string {
  const standing = mine > theirs ? "Leading" : mine < theirs ? "Trailing" : "Level with";
  // "to", not a dash, so a negative score never reads as a range.
  return `${standing} ${opponent ?? "a former member"} ${mine} to ${theirs}`;
}

/**
 * Money: what each player is up or down. What has been paid out is read from
 * the ledger (winnings and refunds in, stakes out). A stake still in play
 * counts at its projected payout, so the board ranks the league before the
 * first payout and each number is the player's "Projected" line until then.
 */
async function moneyEntries(ctx: QueryCtx, league: League, at?: number): Promise<Entry<UserId>[]> {
  // ledger.by_league: every movement of money in this league.
  const ledger = await ctx.db
    .query("ledger")
    .withIndex("by_league", (q) => q.eq("leagueId", league.doc._id))
    .take(MAX_LEDGER_ROWS);
  const lastPayoutAt = Math.max(0, ...ledger.filter((row) => row.kind === "winnings").map((row) => row.createdAt));
  const won = winnings(ledger);
  const net = netMoney(ledger);
  const netYesterday = netMoney(ledger, startOfPacificDay(pacificDay(lastPayoutAt)));
  // Once the stake has been paid out its money is in the ledger and nothing is left to project.
  const inPlay = !paidOut(league) && league.members.length <= MAX_PROJECTED_MEMBERS;
  const projected = inPlay ? await projections(ctx, league, at) : new Map<UserId, Projection>();

  return league.members.flatMap((member) => {
    const projection = projected.get(member.userId);
    // A member who has never put money in has no place on a money table: left on it at $0.00,
    // they would sit above everyone whose stake is at risk.
    if (!net.has(member.userId) && !projection?.eligible) return [];
    // The stake is already out of the ledger, so the whole expected payout comes back in.
    const expected = projection?.eligible ? projection.expectedCents : 0;
    const cents = (dollars: number | undefined) => Math.round((dollars ?? 0) * 100);
    const wonSoFar = won.get(member.userId) ?? 0;
    const detail = [
      ...(wonSoFar > 0 ? [`Won $${wonSoFar.toFixed(2)}`] : []),
      ...(projection?.eligible ? [projectionLabel(projection)] : []),
    ].join(" · ");
    return {
      ...identity(member),
      value: (cents(net.get(member.userId)) + expected) / 100,
      previous: (cents(netYesterday.get(member.userId)) + expected) / 100,
      ...(detail === "" ? {} : { detail }),
    };
  });
}

/**
 * Dollars each player is up or down in the ledger: winnings and refunds in,
 * stakes out. `before` leaves out what was paid out from that moment on; a
 * stake counts whenever it was paid, since it was at risk either way.
 */
export function netMoney(
  ledger: Pick<Doc<"ledger">, "userId" | "kind" | "amountUsd" | "createdAt">[],
  before = Infinity,
): Map<UserId, number> {
  const cents = new Map<UserId, number>();
  for (const row of ledger) {
    if (row.userId === undefined || row.kind === "fee") continue;
    if (row.kind !== "buy_in" && row.createdAt >= before) continue;
    const amount = Math.round(row.amountUsd * 100) * (row.kind === "buy_in" ? -1 : 1);
    cents.set(row.userId, (cents.get(row.userId) ?? 0) + amount);
  }
  return new Map([...cents].map(([userId, total]) => [userId, total / 100]));
}

/** Dollars of winnings per player from ledger rows written before a moment. */
export function winnings(
  ledger: Pick<Doc<"ledger">, "userId" | "kind" | "amountUsd" | "createdAt">[],
  before = Infinity,
): Map<UserId, number> {
  const cents = new Map<UserId, number>();
  for (const row of ledger) {
    if (row.kind !== "winnings" || row.userId === undefined || row.createdAt >= before) continue;
    cents.set(row.userId, (cents.get(row.userId) ?? 0) + Math.round(row.amountUsd * 100));
  }
  return new Map([...cents].map(([userId, total]) => [userId, total / 100]));
}

/**
 * A global board: players from every league, by their points in their best
 * league. weekStart picks the week; ALL_TIME picks the all-time rows.
 */
async function globalEntries(ctx: ReadCtx, weekStart: number): Promise<Entry<UserId>[]> {
  // scores.by_week_points, highest first. The index is the ranking, so the
  // read stops at the top of the table however many players there are. The
  // ranked tree ["points", "global", weekStart] (boardRanks.ts) holds the same
  // order; at this size one index range read is faster than a component call.
  const rows = await ctx.db
    .query("scores")
    .withIndex("by_week_points", (q) => q.eq("weekStart", weekStart))
    .order("desc")
    .take(GLOBAL_ROWS);
  // A player has a row per league, and the first one met is their best.
  const best = new Map<UserId, Doc<"scores">>();
  for (const row of rows) {
    if (!best.has(row.userId)) best.set(row.userId, row);
  }
  const top = [...best.values()].slice(0, GLOBAL_PLAYERS);
  // A row last rebuilt before the newest day on the board did not move during
  // it, so it stood yesterday as it stands now.
  const newestDay = Math.max(0, ...top.map((row) => row.day));

  return await Promise.all(
    top.map(async (row) => {
      const [user, league] = await Promise.all([ctx.db.get("users", row.userId), ctx.db.get("leagues", row.leagueId)]);
      const avatarUrl = await avatarOf(ctx, user);
      return {
        userId: row.userId,
        name: user?.name ?? UNNAMED_PLAYER,
        ...(avatarUrl ? { avatarUrl } : {}),
        value: row.points,
        previous: row.day === newestDay ? row.yesterday.points : row.points,
        ...(league ? { detail: league.name } : {}),
      };
    }),
  );
}

// ---- Earnings projection ----------------------------------------------------------------------

/**
 * What the caller stands to be paid: if the week ended now, and an expected
 * payout with a low and a high case. Null in a free league or for a player
 * who is not a member.
 *
 * `at` is the caller's clock, rounded to the hour by the app. A query must not
 * read the clock itself (it would not rerun as time passes), and the number of
 * days left is the one thing here that depends on it.
 */
export const projection = query({
  args: { leagueId: v.id("leagues"), at: v.optional(v.number()) },
  returns: v.union(
    v.null(),
    v.object({
      label: v.string(),
      eligible: v.boolean(),
      stakeUsd: v.number(),
      ifEndedNowUsd: v.number(),
      expectedUsd: v.number(),
      lowUsd: v.number(),
      highUsd: v.number(),
      finishProbability: v.number(),
    }),
  ),
  handler: async (ctx, { leagueId, at }) => {
    const me = await requireUser(ctx);
    const league = await loadLeague(ctx, leagueId);
    if (league === null || !league.members.some((member) => member.userId === me._id)) return null;
    const mine = (await projections(ctx, league, at, me._id)).get(me._id);
    if (mine === undefined) return null;
    return {
      // Once the stake is paid out there is nothing left to project: the line says what it paid.
      label: paidOut(league) ? settledLabel(mine) : projectionLabel(mine),
      eligible: mine.eligible,
      stakeUsd: mine.stakeCents / 100,
      ifEndedNowUsd: mine.ifEndedNowCents / 100,
      expectedUsd: mine.expectedCents / 100,
      lowUsd: mine.lowCents / 100,
      highUsd: mine.highCents / 100,
      finishProbability: mine.finishProbability,
    };
  },
});

/**
 * Projected payouts for the league's members (or just `only`). Empty in a free
 * league. A weekly league stakes this week's standings; a "season" league holds
 * the stake to the last week, so it is projected on season totals over the
 * days left in the season.
 */
async function projections(ctx: QueryCtx, league: League, at?: number, only?: UserId): Promise<Map<UserId, Projection>> {
  const week = league.current;
  if (week === null || league.doc.stakeUsd <= 0) return new Map();

  const settings = resolveSettings(league.doc);
  const weekly = settings.payout === "weekly";
  const season = seasonOf(week.number, settings.seasonWeeks);
  const staked = weekly
    ? [week]
    : league.weeks.filter((other) => other.number >= season.firstWeek && other.number <= season.lastWeek);
  // Who has paid and what they have scored comes from the settlement's own
  // reading of the league, so "if it ended now" is what settleWeek would pay.
  const entrants = new Map((await entrantsOver(ctx, league.doc._id, staked)).map((entrant) => [entrant.userId, entrant]));
  const weeks = await history(ctx, league, staked[0].startsAt);
  // A season is kept by clearing all five in at least half its weeks (whop.ts),
  // so progress towards the stake is counted in slots of that many weeks.
  const weeksNeeded = weekly ? 1 : Math.ceil(settings.seasonWeeks / 2);
  const slotsNeeded = CORE_SLOTS.length * weeksNeeded;
  const members: ProjectionMember<UserId>[] = league.members.map((member) => {
    const entrant = entrants.get(member.userId);
    const cleared = (weeks.get(member.userId) ?? []).reduce((slots, view) => {
      const inWeek = view.now.stats.slotsCleared;
      // A finished week counts only if it was cleared; the week in play counts as far as it has got.
      return slots + (inWeek === CORE_SLOTS.length || view.weekStart === week.startsAt ? inWeek : 0);
    }, 0);
    return {
      userId: member.userId,
      paid: entrant?.paid ?? false,
      points: entrant?.points ?? 0,
      slotsCleared: Math.min(slotsNeeded, cleared),
    };
  });

  // Without the caller's clock, take the middle of the last day anyone played.
  const lastDayPlayed = Math.max(
    0,
    ...[...weeks.values()].flatMap((views) => weekInPlay(views, league)?.now.activeDays ?? []),
  );
  const now = at ?? startOfPacificDay(pacificDay(week.startsAt) + lastDayPlayed) + DAY_MS / 2;
  const daysLeftThisWeek = week.status === "settled" ? 0 : Math.max(0, week.endsAt - now) / DAY_MS;
  const weeksAfterThis = weekly ? 0 : season.lastWeek - week.number;

  const projected = new Map<UserId, Projection>();
  for (const member of league.members) {
    if (only !== undefined && member.userId !== only) continue;
    projected.set(
      member.userId,
      projectPayout({
        stakeUsd: league.doc.stakeUsd,
        members,
        userId: member.userId,
        daysLeft: daysLeftThisWeek + 7 * weeksAfterThis,
        slotsNeeded,
        periodDays: 7 * (weekly ? 1 : settings.seasonWeeks),
        // Forecast the rule whop.closeWeek will settle with.
        ...(league.doc.mode === "versus" && { settle: computeVersusSettlement }),
      }),
    );
  }
  return projected;
}

/**
 * True once the stake the league plays for has been paid out: a weekly
 * league's settled week, or the settled last week of a season. A "season"
 * league settles every week but holds the stakes until its last one
 * (whop.closeWeek), so until then they are still in play.
 */
function paidOut(league: League): boolean {
  const week = league.current;
  if (week === null || week.status !== "settled") return false;
  const settings = resolveSettings(league.doc);
  return settings.payout === "weekly" || week.number === seasonOf(week.number, settings.seasonWeeks).lastWeek;
}

// ---- Loading a league and its weeks -----------------------------------------------------------

type Member = { userId: UserId; name: string; avatarUrl?: string };

type League = {
  doc: Doc<"leagues">;
  members: Member[];
  /** Oldest first. */
  weeks: Doc<"weeks">[];
  /** The newest week: the one in play, or the one just settled. Null before the league has a week. */
  current: Doc<"weeks"> | null;
};

/** One week of one player: as it stands, and as it stood when the last day of play began. */
type WeekView = { weekStart: number; now: WeekTally; yesterday: WeekTally };

async function loadLeague(ctx: ReadCtx, leagueId: Id<"leagues">): Promise<League | null> {
  const doc = await ctx.db.get("leagues", leagueId);
  if (doc === null) return null;
  const [memberships, newestWeeks] = await Promise.all([
    // memberships.by_league
    membersInJoinOrder(ctx, leagueId),
    // weeks.by_league, newest first so an old league keeps its recent weeks.
    ctx.db
      .query("weeks")
      .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
      .order("desc")
      .take(MAX_WEEKS),
  ]);
  const members = await Promise.all(
    memberships.map(async (membership): Promise<Member> => {
      const user = await ctx.db.get("users", membership.userId);
      const avatarUrl = await avatarOf(ctx, user);
      return {
        userId: membership.userId,
        name: user?.name ?? UNNAMED_PLAYER,
        ...(avatarUrl ? { avatarUrl } : {}),
      };
    }),
  );
  const weeks = newestWeeks.sort((a, b) => a.number - b.number);
  return { doc, members, weeks, current: weeks[weeks.length - 1] ?? null };
}

async function avatarOf(ctx: ReadCtx, user: Doc<"users"> | null): Promise<string | null> {
  if (user?.avatarStorageId) return await ctx.storage.getUrl(user.avatarStorageId);
  return user?.image ?? null;
}

/** Recruiter points (convex/referrals.ts): 25 for each friend a member brought in who locked a lineup. */
async function recruiterEntries(ctx: ReadCtx, league: League): Promise<Entry<UserId>[]> {
  const entries: Entry<UserId>[] = [];
  for (const member of league.members) {
    const { recruiterPoints, locked, invited } = await recruiterTally(ctx, member.userId);
    if (invited === 0) continue;
    // Rewards land when a friend locks a lineup, not on a daily cycle, so there is no movement to show.
    entries.push({ ...identity(member), value: recruiterPoints, previous: recruiterPoints, detail: `${locked}/${invited} friends locked` });
  }
  return entries;
}

function identity(member: Member): Pick<Entry<UserId>, "userId" | "name" | "avatarUrl"> {
  return {
    userId: member.userId,
    name: member.name,
    ...(member.avatarUrl === undefined ? {} : { avatarUrl: member.avatarUrl }),
  };
}

/** startsAt of the first week of the season the league is in. */
function seasonStart(league: League): number {
  const current = league.current!;
  const { firstWeek } = seasonOf(current.number, resolveSettings(league.doc).seasonWeeks);
  return league.weeks.find((week) => week.number >= firstWeek)?.startsAt ?? current.startsAt;
}

function weekInPlay(views: WeekView[], league: League): WeekView | undefined {
  return views.find((view) => view.weekStart === league.current?.startsAt);
}

/**
 * Every member's weeks from `from` on: finished weeks from their stored rows,
 * the week in play tallied live.
 */
async function history(ctx: ReadCtx, league: League, from: number): Promise<Map<UserId, WeekView[]>> {
  const current = league.current!;
  const byMember = new Map<UserId, WeekView[]>(league.members.map((member) => [member.userId, []]));
  if (from < current.startsAt) {
    // scores.by_league_week_user over [from, the week in play): one range
    // read, whatever the number of members and weeks.
    const stored = await ctx.db
      .query("scores")
      .withIndex("by_league_week_user", (q) =>
        q.eq("leagueId", league.doc._id).gte("weekStart", from).lt("weekStart", current.startsAt),
      )
      .take(MAX_STORED_ROWS);
    for (const row of stored) {
      // A finished week no longer moves: it stood yesterday as it stands now.
      const tally = { stats: row.now, activeDays: row.activeDays };
      byMember.get(row.userId)?.push({ weekStart: row.weekStart, now: tally, yesterday: tally });
    }
  }
  for (const [userId, view] of await leagueWeek(ctx, league, current)) byMember.get(userId)?.push(view);
  return byMember;
}

/**
 * One week of a league, tallied from tasks and proofs the way the standings
 * are (leagueStandings in standings.ts): every member as they stand, and as
 * they stood when `dayBegan`. A final score kept on the week's matchup
 * replaces the tally.
 *
 * A query leaves `dayBegan` out, because a query that read the clock would not
 * rerun at midnight. "Yesterday" is then the start of the last day anyone in
 * the league proved something: this morning on a day with play, and on a quiet
 * day the arrows keep showing the last day's moves.
 */
async function leagueWeek(
  ctx: ReadCtx,
  league: League,
  week: Doc<"weeks">,
  dayBegan?: number,
): Promise<Map<UserId, WeekView>> {
  const adjustments = await challengerPointsByUser(ctx, league.doc._id, { from: week.startsAt, to: week.endsAt });
  const facts = await Promise.all(
    league.members.map((member) =>
      weekFacts(ctx, league.doc._id, member.userId, week.startsAt, adjustments.get(member.userId) ?? 0),
    ),
  );
  const now = facts.map((memberFacts) => tallyWeek(memberFacts));
  const lastDayPlayed = Math.max(0, ...now.flatMap((tally) => tally.activeDays));
  const since = dayBegan ?? startOfPacificDay(pacificDay(week.startsAt) + lastDayPlayed);
  const yesterday = facts.map((memberFacts) => tallyWeek(memberFacts, since));

  // matchups.by_week
  const pairs = await ctx.db
    .query("matchups")
    .withIndex("by_week", (q) => q.eq("weekId", week._id))
    .take(MAX_MEMBERS);
  // Both sides of every pair are compared on their points before any bonus lands.
  const before = new Map(league.members.map((member, i) => [member.userId, now[i].stats.points]));
  const at = new Map(league.members.map((member, i) => [member.userId, i]));
  // A member with the week off has a stand-in row so their Matchup tab is not empty. It is not a
  // game, and counting it would give the member it borrows a second bonus (standings.ts).
  const games = new Set(
    withoutStandIns(pairs.map((row) => ({ ...row, a: row.userA, b: row.userB }))).map((row) => row._id),
  );
  const sides = pairs.flatMap((pair) => [
    { mine: pair.userA, theirs: pair.userB, final: pair.scoreA, game: games.has(pair._id) },
    { mine: pair.userB, theirs: pair.userA, final: pair.scoreB, game: games.has(pair._id) },
  ]);
  for (const { mine, theirs, final, game } of sides) {
    const i = at.get(mine);
    if (i === undefined) continue;
    if (final !== undefined) {
      // A final score kept on the matchup is the week's result, whatever tasks
      // are still around to add up (seasons.ts reads it the same way). The
      // seeded season's earlier weeks are nothing but these. A finished week
      // stood yesterday as it stands now.
      now[i].stats.points = final;
      yesterday[i].stats.points = final;
      continue;
    }
    // Once a week has settled, the higher scorer of each pair holds the matchup bonus.
    if (week.status !== "settled" || !game) continue;
    const bonus = matchupBonus(before.get(mine) ?? 0, before.get(theirs) ?? Infinity);
    if (bonus === 0) continue;
    now[i].stats.points += bonus;
    // A week that ended before the day began had settled by then. One ended
    // early (End Week Now) gained its bonus today, and that shows as a move.
    if (week.endsAt <= since) yesterday[i].stats.points += bonus;
  }
  return new Map(
    league.members.map((member, i) => [member.userId, { weekStart: week.startsAt, now: now[i], yesterday: yesterday[i] }]),
  );
}

/** What one player did in one week, as far as it scores in this league. */
async function weekFacts(
  ctx: ReadCtx,
  leagueId: Id<"leagues">,
  userId: UserId,
  weekStart: number,
  adjustment: number,
): Promise<WeekFacts> {
  const [tasks, proofs] = await Promise.all([
    // tasks.by_user_week
    ctx.db
      .query("tasks")
      .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", weekStart))
      .take(MAX_WEEK_TASKS),
    // proofs.by_user_week
    ctx.db
      .query("proofs")
      .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", weekStart))
      .take(MAX_WEEK_PROOFS),
  ]);
  const scoring: Doc<"tasks">[] = [];
  const quickTimeOpenedAt = new Map<Id<"drops">, number>();
  for (const task of tasks) {
    if (task.dropId !== undefined) {
      // One lineup scores in every league the player is in, but a drop's task
      // only in the league that ran the drop.
      const drop = await ctx.db.get("drops", task.dropId);
      if (drop === null || drop.leagueId !== leagueId) continue;
      if (drop.kind === "quicktime") quickTimeOpenedAt.set(drop._id, drop.opensAt);
    }
    scoring.push(task);
  }
  return { weekStart, tasks: scoring, proofs, quickTimeOpenedAt, adjustment };
}

// ---- Keeping the stored rows current ----------------------------------------------------------

/**
 * Rebuilds the stored rows for one player's week, in every league they play
 * in. Whatever verifies a proof or changes a task's score schedules this. It
 * recomputes from tasks and proofs and writes nothing when nothing changed, so
 * it is safe to run twice, late, or for a week long finished.
 */
export const refresh = internalMutation({
  args: { userId: v.id("users"), weekStart: v.number() },
  returns: v.null(),
  handler: async (ctx, { userId, weekStart }) => {
    // memberships.by_user
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_LEAGUES_PER_PLAYER);
    const today = startOfPacificDay(pacificDay(Date.now()));
    for (const { leagueId } of memberships) {
      const league = await loadLeague(ctx, leagueId);
      const week = league?.weeks.find((other) => other.startsAt === weekStart);
      // The whole league's week, not just this player's row: one player's
      // points can move another's (a matchup, a first-finisher bonus).
      if (league && week) await storeLeagueWeek(ctx, league, week, today);
    }
    await storeAllTime(ctx, userId, today);
    return null;
  },
});

/**
 * Asks for a league's stored rows to be rebuilt. The Leaderboards screen calls
 * it on opening, which makes the season, all-time and global boards
 * self-healing: whatever a writer forgot to schedule, they are right by the
 * time they are read. The work runs after this returns, so the screen never
 * waits on it.
 */
export const sync = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const me = await requireUser(ctx);
    // memberships.by_league_user
    const membership = await membershipOf(ctx, leagueId, me._id);
    if (membership !== null) await ctx.scheduler.runAfter(0, internal.leaderboards.rebuild, { leagueId });
    return null;
  },
});

/** Rebuilds every member's stored rows for a league's recent weeks. Also run after a seed reset and a settlement. */
export const rebuild = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const league = await loadLeague(ctx, leagueId);
    if (league === null) return null;
    const today = startOfPacificDay(pacificDay(Date.now()));
    for (const week of league.weeks) await storeLeagueWeek(ctx, league, week, today);
    for (const member of league.members) await storeAllTime(ctx, member.userId, today);
    await removeStrayRows(ctx, league);
    return null;
  },
});

/**
 * Deletes the league's stored rows that no longer belong to anything: a player
 * who has left (a seed reset drops late joiners) or a week that was removed.
 * Left alone they would sit on the global boards for ever.
 */
async function removeStrayRows(ctx: MutationCtx, league: League): Promise<void> {
  const memberIds = new Set(league.members.map((member) => member.userId));
  // Only a league whose every week was loaded can tell a removed week from an old one.
  const weekStarts = league.weeks.length < MAX_WEEKS ? new Set(league.weeks.map((week) => week.startsAt)) : null;
  // scores.by_league_week_user: every stored row of this league.
  const rows = await ctx.db
    .query("scores")
    .withIndex("by_league_week_user", (q) => q.eq("leagueId", league.doc._id))
    .take(MAX_STORED_ROWS);
  const strays = rows.filter(
    (row) =>
      !memberIds.has(row.userId) || (row.weekStart !== ALL_TIME && weekStarts !== null && !weekStarts.has(row.weekStart)),
  );
  for (const row of strays) await removeRow(ctx, row);
  // A member whose removed week was their only one still has an all-time row to recount.
  const today = startOfPacificDay(pacificDay(Date.now()));
  for (const userId of new Set(strays.map((row) => row.userId))) {
    if (memberIds.has(userId)) await storeAllTime(ctx, userId, today);
  }
}

/**
 * Stores every member's row for one week of a league. A member who scored
 * nothing gets a row of zeros: they are on the global board at the bottom, and
 * a row left from before a seed reset is overwritten rather than left behind.
 */
async function storeLeagueWeek(ctx: MutationCtx, league: League, week: Doc<"weeks">, today: number): Promise<void> {
  for (const [userId, view] of await leagueWeek(ctx, league, week, today)) {
    await store(ctx, {
      leagueId: league.doc._id,
      userId,
      weekStart: week.startsAt,
      points: view.now.stats.points,
      now: view.now.stats,
      yesterday: view.yesterday.stats,
      day: today,
      activeDays: view.now.activeDays,
    });
  }
}

/** The all-time row of each league a player is in: the totals of their week rows there. */
async function storeAllTime(ctx: MutationCtx, userId: UserId, today: number): Promise<void> {
  // scores.by_user_week: every row this player has, in every league.
  const rows = await ctx.db
    .query("scores")
    .withIndex("by_user_week", (q) => q.eq("userId", userId))
    .take(MAX_STORED_ROWS);
  const byLeague = new Map<Id<"leagues">, Doc<"scores">[]>();
  for (const row of rows) {
    if (row.weekStart !== ALL_TIME) byLeague.set(row.leagueId, [...(byLeague.get(row.leagueId) ?? []), row]);
  }
  // An all-time row with no week left under it totals nothing.
  for (const row of rows) {
    if (row.weekStart === ALL_TIME && !byLeague.has(row.leagueId)) await removeRow(ctx, row);
  }

  for (const [leagueId, weeks] of byLeague) {
    const now = totalStats(weeks.map((row) => ({ weekStart: row.weekStart, stats: row.now, activeDays: row.activeDays })));
    // A week row rebuilt before today did not move today, so it stood yesterday as it stands now.
    const yesterday = totalStats(
      weeks.map((row) => ({
        weekStart: row.weekStart,
        stats: row.day === today ? row.yesterday : row.now,
        activeDays: row.activeDays,
      })),
    );
    await store(ctx, { leagueId, userId, weekStart: ALL_TIME, points: now.points, now, yesterday, day: today, activeDays: [] });
  }
}

type ScoreRow = Omit<Doc<"scores">, "_id" | "_creationTime">;

/**
 * Inserts or replaces the row for (league, week, player), and leaves it alone
 * when nothing changed. It and `removeRow` are the only writers of `scores`,
 * and both move the row's entries in the ranked trees (boardRanks.ts) in the
 * same transaction, so a tree never disagrees with the table.
 */
async function store(ctx: MutationCtx, row: ScoreRow): Promise<void> {
  const existing = await storedRow(ctx, row.leagueId, row.weekStart, row.userId);
  if (existing === null) {
    const id = await ctx.db.insert("scores", row);
    await syncRanks(ctx, null, { ...row, _id: id, _creationTime: Date.now() });
    return;
  }
  // `day` alone moving on is not a change worth a write: readers treat an
  // older day as "did not move today", which is exactly what it means.
  const unchanged =
    sameStats(existing.now, row.now) &&
    sameStats(existing.yesterday, row.yesterday) &&
    existing.activeDays.join() === row.activeDays.join();
  if (unchanged) return;
  await ctx.db.replace("scores", existing._id, row);
  await syncRanks(ctx, existing, { ...existing, ...row });
}

async function removeRow(ctx: MutationCtx, row: Doc<"scores">): Promise<void> {
  await ctx.db.delete("scores", row._id);
  await syncRanks(ctx, row, null);
}

async function storedRow(
  ctx: ReadCtx,
  leagueId: Id<"leagues">,
  weekStart: number,
  userId: UserId,
): Promise<Doc<"scores"> | null> {
  // scores.by_league_week_user
  return await ctx.db
    .query("scores")
    .withIndex("by_league_week_user", (q) => q.eq("leagueId", leagueId).eq("weekStart", weekStart).eq("userId", userId))
    .unique();
}

export function sameStats(a: ScoreStats, b: ScoreStats): boolean {
  return (
    a.points === b.points &&
    a.slotsCleared === b.slotsCleared &&
    a.streak === b.streak &&
    a.tasksVerified === b.tasksVerified &&
    CORE_SLOTS.every((slot) => a.slotPoints[slot] === b.slotPoints[slot]) &&
    a.bestHighlight === b.bestHighlight &&
    a.bestProofId === b.bestProofId &&
    a.fastestQuickTimeSec === b.fastestQuickTimeSec
  );
}
