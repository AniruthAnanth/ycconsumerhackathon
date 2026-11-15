/**
 * A league's season: its settings, the schedule with results, the table and
 * the playoff bracket.
 *
 * Nothing here is stored. Weeks that have been opened are read from the weeks
 * and matchups rows, so a pairing never changes after the fact; weeks still
 * to come are projected from the current members with lib/schedule.ts.
 * buildSeason does that assembly as a pure function over ids, and the query
 * only loads rows for it and adds names.
 */
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { membersInJoinOrder, membershipOf } from "./leagues";
import { requireUser } from "./lib/auth";
import { UNNAMED_PLAYER } from "./lib/names";
import {
  bracketFor,
  MAX_SEASON_WEEKS,
  resolveSettings,
  scheduleFor,
  seasonOf,
  seasonTable,
  winnerOf,
  withoutStandIns,
  withStandIns,
  type Bracket,
  type LeagueSettings,
  type Pairing,
  type Result,
  type TableRow,
} from "./lib/schedule";
import { leagueFormat, payout } from "./schema";
import { leagueStandings } from "./standings";

type UserId = Id<"users">;

// ---- Assembly (pure) --------------------------------------------------------

export type SeasonInput<Id> = {
  settings: LeagueSettings;
  members: { id: Id; joinedAt: number }[];
  // The weeks rows that exist, by league week number. live is the week being
  // played now.
  openedWeeks: { number: number; startsAt: number; endsAt: number; live: boolean }[];
  // Every matchup of those weeks with each side's points.
  results: Result<Id>[];
};

export type SeasonWeek<Id> = {
  number: number; // week of the season, starting at 1
  status: "final" | "live" | "upcoming";
  round?: string; // playoff weeks only
  matchups: {
    a: Id;
    b: Id;
    scoreA: number | null;
    scoreB: number | null;
    winnerId: Id | null;
  }[];
  byes: Id[];
};

export type SeasonView<Id> = {
  season: number;
  currentWeek: number; // week of the season
  weeks: SeasonWeek<Id>[];
  table: (TableRow<Id> & { rank: number })[];
  bracket: Pick<Bracket<Id>, "projected" | "rounds" | "champion"> | null;
};

/**
 * The season the league is in now, week by week.
 *
 * Week numbers in the result count from the start of the season, because
 * "week 2 of 8" is what a player reads; the rows and lib/schedule.ts count
 * from the league's first week.
 */
export function buildSeason<Id extends string>({
  settings,
  members,
  openedWeeks,
  results,
}: SeasonInput<Id>): SeasonView<Id> {
  const memberIds = members.map((member) => member.id);
  const newest = Math.max(0, ...openedWeeks.map((week) => week.number));
  const currentWeek = Math.max(newest, 1); // a league with no week yet is about to play week 1
  const season = seasonOf(currentWeek, settings.seasonWeeks);
  const weekOfSeason = (leagueWeek: number) => leagueWeek - season.firstWeek + 1;
  const played = results.filter(
    (result) => result.week >= season.firstWeek && result.week <= season.lastWeek,
  );
  const joined = joinedWeeks(members, openedWeeks);
  const bracket =
    settings.format === "bracket"
      ? bracketFor(memberIds, currentWeek, played, settings.seasonWeeks, joined)
      : null;
  const currentIsLive = openedWeeks.some(
    (week) => week.number === newest && week.live,
  );

  const weeks: SeasonWeek<Id>[] = [];
  for (let number = season.firstWeek; number <= season.lastWeek; number++) {
    const round = bracket?.rounds.find((r) => r.week === number)?.name;
    const label = {
      number: weekOfSeason(number),
      ...(round === undefined ? {} : { round }),
    };
    const opened = openedWeeks.find((week) => week.number === number);

    if (opened !== undefined) {
      const matchups = played.filter((result) => result.week === number);
      const playing = new Set(matchups.flatMap((result) => [result.a, result.b]));
      const bracketMatches = bracket?.rounds.find((r) => r.week === number)?.matches ?? [];
      weeks.push({
        ...label,
        status: opened.live ? "live" : "final",
        matchups: matchups.map((result) => ({
          a: result.a,
          b: result.b,
          scoreA: result.scoreA,
          scoreB: result.scoreB,
          // A tied playoff game still sends someone through, and the bracket
          // says who; a tie anywhere else has no winner.
          winnerId:
            winnerOf(result) ??
            bracketMatches.find(
              (match) =>
                (match.a === result.a && match.b === result.b) ||
                (match.a === result.b && match.b === result.a),
            )?.winner ??
            null,
        })),
        // Someone who joined after the week ended did not have that week off.
        byes: members
          .filter((member) => member.joinedAt < opened.endsAt && !playing.has(member.id))
          .map((member) => member.id),
      });
      continue;
    }

    // A playoff round's pairings exist only once the week before it is over.
    // Until then the schedule shows the round with nobody in it, and the
    // bracket shows who is on course for it.
    const undecided =
      round !== undefined && (currentIsLive || number !== newest + 1);
    const pairings = undecided
      ? []
      : scheduleFor(settings.format, memberIds, number, played, settings.seasonWeeks, joined);
    const playing = new Set(pairings.flatMap((pairing) => [pairing.a, pairing.b]));
    weeks.push({
      ...label,
      status: "upcoming",
      matchups: pairings.map((pairing) => ({
        ...pairing,
        scoreA: null,
        scoreB: null,
        winnerId: null,
      })),
      byes: undecided ? [] : memberIds.filter((id) => !playing.has(id)),
    });
  }

  // Playoff games decide the bracket, not the table the bracket was seeded from.
  const counted =
    bracket === null
      ? played
      : played.filter((result) => result.week < bracket.firstWeek);

  return {
    season: season.number,
    currentWeek: weekOfSeason(currentWeek),
    weeks,
    table: seasonTable(memberIds, counted).map((row, index) => ({
      ...row,
      rank: index + 1,
    })),
    bracket:
      bracket === null
        ? null
        : {
            projected: bracket.projected,
            champion: bracket.champion,
            rounds: bracket.rounds.map((r) => ({ ...r, week: weekOfSeason(r.week) })),
          },
  };
}

/**
 * The league week each member joined in, which is what decides a bracket's
 * field: the newest of the opened weeks that had begun when they joined.
 * Someone who was there before the first of them gets the number before it.
 */
function joinedWeeks<Id>(
  members: SeasonInput<Id>["members"],
  openedWeeks: SeasonInput<Id>["openedWeeks"],
): Map<Id, number> {
  if (openedWeeks.length === 0) {
    return new Map();
  }
  const before = Math.min(...openedWeeks.map((week) => week.number)) - 1;
  return new Map(
    members.map((member) => [
      member.id,
      Math.max(
        before,
        ...openedWeeks
          .filter((week) => week.startsAt < member.joinedAt)
          .map((week) => week.number),
      ),
    ]),
  );
}

// ---- Loading ----------------------------------------------------------------

/** A bound, not a page size: a league is a group of friends. */
const MAX_MEMBERS = 200;

async function loadMembers(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
): Promise<{ id: UserId; joinedAt: number }[]> {
  const memberships = await membersInJoinOrder(ctx, leagueId);
  return memberships.map((m) => ({ id: m.userId, joinedAt: m.joinedAt }));
}

/**
 * Every member's points for one league week. They come from standings.ts, so
 * a matchup here shows the same numbers as the League and Matchup tabs.
 */
async function weekPoints(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  weekId: Id<"weeks">,
): Promise<Map<UserId, number>> {
  const standings = await leagueStandings(ctx, leagueId, weekId);
  return new Map(standings.map((standing) => [standing.userId, standing.points]));
}

async function loadSeason(
  ctx: QueryCtx,
  league: Doc<"leagues">,
): Promise<SeasonInput<UserId>> {
  const settings = resolveSettings(league);
  const weekRows = await ctx.db
    .query("weeks")
    .withIndex("by_league", (q) => q.eq("leagueId", league._id))
    .order("desc")
    .take(MAX_SEASON_WEEKS);
  const newest = Math.max(0, ...weekRows.map((week) => week.number));
  const season = seasonOf(Math.max(newest, 1), settings.seasonWeeks);
  const seasonRows = weekRows.filter((week) => week.number >= season.firstWeek);
  const isLive = (week: Doc<"weeks">) =>
    week.number === newest && week.status === "open";

  const results: Result<UserId>[] = [];
  for (const week of seasonRows) {
    const stored = await ctx.db
      .query("matchups")
      .withIndex("by_week", (q) => q.eq("weekId", week._id))
      .take(MAX_MEMBERS);
    // A member with the week off has a stand-in row; the season shows a bye.
    const matchups = withoutStandIns(
      stored.map((matchup) => ({ ...matchup, a: matchup.userA, b: matchup.userB })),
    );
    // Scores frozen on the rows win. A week without them is scored once, for
    // everyone; a player who has since left the league scores nothing.
    const frozen = matchups.every(
      (matchup) => matchup.scoreA !== undefined && matchup.scoreB !== undefined,
    );
    const points = frozen ? null : await weekPoints(ctx, league._id, week._id);
    for (const matchup of matchups) {
      results.push({
        week: week.number,
        a: matchup.a,
        b: matchup.b,
        scoreA: matchup.scoreA ?? points?.get(matchup.a) ?? 0,
        scoreB: matchup.scoreB ?? points?.get(matchup.b) ?? 0,
        ...(isLive(week) ? { live: true } : {}),
      });
    }
  }

  return {
    settings,
    members: await loadMembers(ctx, league._id),
    openedWeeks: seasonRows.map((week) => ({
      number: week.number,
      startsAt: week.startsAt,
      endsAt: week.endsAt,
      live: isLive(week),
    })),
    results,
  };
}

/**
 * The matchups to store for a league week, for whoever opens that week: the
 * league's format applied to its current members, plus a stand-in for anyone
 * with the week off. Only the bracket needs the earlier results, so the
 * round-robin formats don't pay for loading them.
 */
export async function pairingsForWeek(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  weekNumber: number,
): Promise<Pairing<UserId>[]> {
  const league = await ctx.db.get("leagues", leagueId);
  if (league === null) throw new ConvexError("That league doesn't exist.");
  const settings = resolveSettings(league);

  let memberIds: UserId[];
  let earlier: Result<UserId>[] = [];
  let joined = new Map<UserId, number>();
  if (settings.format === "bracket") {
    const season = await loadSeason(ctx, league);
    memberIds = season.members.map((member) => member.id);
    joined = joinedWeeks(season.members, season.openedWeeks);
    // Opening a week means the ones before it are over, even if the newest
    // of them has not been marked settled yet.
    earlier = season.results
      .filter((result) => result.week < weekNumber)
      .map((result) => ({ ...result, live: false }));
  } else {
    memberIds = (await loadMembers(ctx, leagueId)).map((member) => member.id);
  }
  const pairings = scheduleFor(
    settings.format,
    memberIds,
    weekNumber,
    earlier,
    settings.seasonWeeks,
    joined,
  );
  return withStandIns(pairings, memberIds);
}

// ---- Query ------------------------------------------------------------------

const player = {
  userId: v.id("users"),
  name: v.string(),
  avatarUrl: v.optional(v.string()),
};
const seededPlayer = v.union(v.object({ ...player, seed: v.number() }), v.null());
const score = v.union(v.number(), v.null());
const userOrNull = v.union(v.id("users"), v.null());

export const overview = query({
  args: { leagueId: v.id("leagues") },
  returns: v.object({
    settings: v.object({ payout, seasonWeeks: v.number(), format: leagueFormat }),
    season: v.number(), // 1 for the league's first season
    currentWeek: v.number(), // week of the season, starting at 1
    meId: v.id("users"),
    weeks: v.array(
      v.object({
        number: v.number(),
        status: v.union(v.literal("final"), v.literal("live"), v.literal("upcoming")),
        round: v.optional(v.string()),
        matchups: v.array(
          v.object({
            a: v.object(player),
            b: v.object(player),
            scoreA: score,
            scoreB: score,
            winnerId: userOrNull,
          }),
        ),
        byes: v.array(v.object(player)),
      }),
    ),
    table: v.array(
      v.object({
        ...player,
        rank: v.number(),
        wins: v.number(),
        losses: v.number(),
        ties: v.number(),
        pointsFor: v.number(),
      }),
    ),
    bracket: v.union(
      v.null(),
      v.object({
        projected: v.boolean(),
        rounds: v.array(
          v.object({
            week: v.number(),
            name: v.string(),
            matches: v.array(
              v.object({
                a: seededPlayer,
                b: seededPlayer,
                scoreA: score,
                scoreB: score,
                winnerId: userOrNull,
                bye: v.boolean(),
              }),
            ),
          }),
        ),
        championId: userOrNull,
      }),
    ),
  }),
  handler: async (ctx, { leagueId }) => {
    const me = await requireUser(ctx);
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null) throw new ConvexError("That league doesn't exist.");
    // A season names every member and what each scored, so only members read it.
    const membership = await membershipOf(ctx, leagueId, me._id);
    if (membership === null) throw new ConvexError("You are not in this league.");

    const input = await loadSeason(ctx, league);
    const view = buildSeason(input);

    // Names for everyone the season mentions, including a player who has
    // left the league but still appears in an old result.
    const players = new Map<UserId, { userId: UserId; name: string; avatarUrl?: string }>();
    const mentioned = new Set([
      ...input.members.map((member) => member.id),
      ...input.results.flatMap((result) => [result.a, result.b]),
    ]);
    for (const userId of mentioned) {
      const user = await ctx.db.get("users", userId);
      const avatarUrl = user?.avatarStorageId
        ? await ctx.storage.getUrl(user.avatarStorageId)
        : user?.image;
      players.set(userId, {
        userId,
        name: user?.name ?? UNNAMED_PLAYER,
        ...(avatarUrl ? { avatarUrl } : {}),
      });
    }
    const playerOf = (userId: UserId) =>
      players.get(userId) ?? { userId, name: UNNAMED_PLAYER };
    const seeded = (userId: UserId | null, seed: number | null) =>
      userId === null ? null : { ...playerOf(userId), seed: seed ?? 0 };

    return {
      settings: input.settings,
      season: view.season,
      currentWeek: view.currentWeek,
      meId: me._id,
      weeks: view.weeks.map((week) => ({
        ...week,
        matchups: week.matchups.map((matchup) => ({
          ...matchup,
          a: playerOf(matchup.a),
          b: playerOf(matchup.b),
        })),
        byes: week.byes.map(playerOf),
      })),
      table: view.table.map((row) => ({
        ...playerOf(row.id),
        rank: row.rank,
        wins: row.wins,
        losses: row.losses,
        ties: row.ties,
        pointsFor: row.pointsFor,
      })),
      bracket:
        view.bracket === null
          ? null
          : {
              projected: view.bracket.projected,
              championId: view.bracket.champion,
              rounds: view.bracket.rounds.map((round) => ({
                week: round.week,
                name: round.name,
                matches: round.matches.map((match) => ({
                  a: seeded(match.a, match.seedA),
                  b: seeded(match.b, match.seedB),
                  scoreA: match.scoreA,
                  scoreB: match.scoreB,
                  winnerId: match.winner,
                  bye: match.bye,
                })),
              })),
            },
    };
  },
});
