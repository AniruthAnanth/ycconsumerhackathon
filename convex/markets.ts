/**
 * Prediction-market numbers for the Matchup and League tabs: the chance to win this week's
 * matchup and how it moved, the projected payout and final score, and every member's odds of
 * topping the week. The math lives in lib/markets.ts; this module only loads the week and replays
 * it proof by proof.
 *
 * A query can't read the clock, so "now" is the moment of the league's latest verified proof
 * (or the week's end once it has settled), the way standings date streaks. Odds move when a
 * proof lands, as a market's price moves on a trade, and every screen agrees on them.
 *
 * Nothing is stored. The history is rebuilt from proof timestamps: at each verified proof the
 * week is re-scored as if only the proofs up to that moment existed, so the chart can never
 * disagree with the proofs it is drawn from.
 */
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { currentWeek, membersInJoinOrder } from "./leagues";
import { requireUser } from "./lib/auth";
import {
  completionRate,
  deltaSince,
  projectScore,
  remainingChance,
  thin,
  simulatePot,
  winChance,
  type HistoryPoint,
  type ScoreProjection,
} from "./lib/markets";
import { projectPayout } from "./lib/projection";
import { resolveSettings } from "./lib/schedule";
import { clearedSlots, CORE_SLOTS, SLOT_CLEARED_BONUS, type ScorableTask } from "./lib/scoring";
import { pacificDay, startOfPacificDay } from "./lib/week";
import { leagueStandings, opponentInWeek, tasksCountingIn, type MemberStanding } from "./standings";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAST_TASKS = 200;
const PROOFS_PER_WEEK = 500;
const SPARKLINE_POINTS = 12;

/** One member's week, with the moment each task was first verified. */
export type Replay = {
  standing: MemberStanding;
  rate: number;
  tasks: { task: Doc<"tasks">; verifiedAt?: number }[];
  /** Turns raw task points at a moment into league points, so streak and challenge bonuses ride along. */
  scale: number;
};

async function loadReplay(ctx: QueryCtx, leagueId: Id<"leagues">, week: Doc<"weeks">, standing: MemberStanding, dropLeagues: Map<Id<"drops">, Id<"leagues"> | null>): Promise<Replay> {
  const userId = standing.userId;
  const tasks = await tasksCountingIn(ctx, leagueId, userId, week.startsAt, dropLeagues);
  const proofs = await ctx.db
    .query("proofs")
    .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", week.startsAt))
    .take(PROOFS_PER_WEEK);
  const firstPass = new Map<Id<"tasks">, number>();
  for (const proof of proofs) {
    if (!proof.pass) continue;
    firstPass.set(proof.taskId, Math.min(firstPass.get(proof.taskId) ?? Infinity, proof.createdAt));
  }
  // Only tasks verified today count as verified in the replay, at the time their first passing proof landed.
  const timed = tasks.map((task) => {
    const at = task.status === "verified" ? firstPass.get(task._id) : undefined;
    return at === undefined ? { task } : { task, verifiedAt: at };
  });

  const past = await ctx.db
    .query("tasks")
    .withIndex("by_user_week", (q) => q.eq("userId", userId).lt("weekStart", week.startsAt))
    .order("desc")
    .take(PAST_TASKS);
  const rate = completionRate(past.filter((task) => task.status === "verified").length, past.length);

  const replay: Replay = { standing, rate, tasks: timed, scale: 1 };
  const raw = stateAt(replay, Infinity, week).rawConfirmed;
  replay.scale = raw > 0 ? standing.points / raw : 1;
  return replay;
}

/** The member's week as it stood at `at`: what was banked, what was still open and what each open task was worth. */
function stateAt(replay: Replay, at: number, week: Doc<"weeks">) {
  // The drafted lineup is the week's opening book. A task added later (flex, drop, group) joins when it was created or first proved.
  const existing = replay.tasks.filter(
    ({ task, verifiedAt }) => task.source === "draft" || Math.min(task._creationTime, verifiedAt ?? Infinity) <= at,
  );
  const scorable: ScorableTask[] = existing.map(({ task, verifiedAt }) => ({
    slot: task.slot,
    points: task.points,
    source: task.source,
    status: verifiedAt !== undefined && verifiedAt <= at ? "verified" : "open",
  }));
  const cleared = new Set<string>(clearedSlots(scorable));
  const rawConfirmed = existing.reduce((sum, { task, verifiedAt }) => {
    if (verifiedAt === undefined || verifiedAt > at) return sum;
    return sum + task.points + (task.source === "draft" && task.slot !== "flex" ? SLOT_CLEARED_BONUS : 0);
  }, 0);
  // An open drafted task in a slot not yet cleared also earns that slot's bonus when it lands.
  const open = existing
    .filter(({ verifiedAt }) => verifiedAt === undefined || verifiedAt > at)
    .map(({ task }) => {
      const clearsSlot = task.source === "draft" && task.slot !== "flex" && !cleared.has(task.slot) ? task.slot : undefined;
      return { value: task.points + (clearsSlot ? SLOT_CLEARED_BONUS : 0), ...(clearsSlot && { clearsSlot }) };
    });
  const chance = remainingChance(replay.rate, (week.endsAt - at) / (week.endsAt - week.startsAt));
  const confirmed = Number.isFinite(at) ? Math.round(rawConfirmed * replay.scale) : replay.standing.points;
  return {
    rawConfirmed,
    slotsCleared: cleared.size,
    open,
    chance,
    projection: projectScore({ confirmed, openValues: open.map((task) => task.value), chance }),
  };
}


/** Every member's replay for the week, best first, and the moment the market is priced at. */
export async function loadMarket(ctx: QueryCtx, leagueId: Id<"leagues">, week: Doc<"weeks">, standings: MemberStanding[]) {
  const dropLeagues = new Map<Id<"drops">, Id<"leagues"> | null>();
  const replays: Replay[] = [];
  for (const standing of standings) replays.push(await loadReplay(ctx, leagueId, week, standing, dropLeagues));
  const latestProof = Math.max(week.startsAt, ...verifiedMoments(replays, week.endsAt));
  const asOf = week.status === "settled" ? week.endsAt : Math.min(latestProof, week.endsAt);
  return { replays, asOf };
}

function verifiedMoments(replays: Replay[], until: number): number[] {
  const moments = replays.flatMap((replay) => replay.tasks.flatMap(({ verifiedAt }) => (verifiedAt !== undefined && verifiedAt <= until ? [verifiedAt] : [])));
  return [...new Set(moments)].sort((a, b) => a - b);
}

/**
 * The caller's chance to beat `theirs` at `at`, in whole percent as standings.matchup reports it.
 * An open week never shows 0% or 100%: one proof can still swing it.
 */
export function matchupChanceAt(mine: Replay, theirs: Replay, at: number, week: Doc<"weeks">): number {
  const chance = Math.round(winChance(stateAt(mine, at, week).projection, stateAt(theirs, at, week).projection) * 100) / 100;
  return week.status === "settled" ? chance : Math.min(0.99, Math.max(0.01, chance));
}

const scoreRange = v.object({ confirmed: v.number(), projected: v.number(), low: v.number(), high: v.number() });
const toRange = (projection: ScoreProjection) => ({
  confirmed: projection.confirmed,
  projected: Math.round(projection.mean),
  low: projection.low,
  high: projection.high,
});

/** Everything the market cards show for the caller in their league's current week. Null for a non-member or a league without a week. */
export const week = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(
    v.null(),
    v.object({
      asOf: v.number(),
      endsAt: v.number(),
      me: scoreRange,
      matchup: v.union(
        v.null(),
        v.object({
          opponentId: v.id("users"),
          opponentName: v.string(),
          chance: v.number(),
          deltaToday: v.number(),
          history: v.array(v.object({ at: v.number(), chance: v.number() })),
          opponent: scoreRange,
        }),
      ),
      payout: v.object({
        eligible: v.boolean(),
        stakeUsd: v.number(),
        expectedNetUsd: v.number(),
        lowNetUsd: v.number(),
        highNetUsd: v.number(),
        potChance: v.number(),
        history: v.array(v.object({ at: v.number(), netUsd: v.number() })),
      }),
      odds: v.object({
        /** "pot" in a staked league; "week" (chance of the top score) in a free one, which has no pot. */
        kind: v.union(v.literal("pot"), v.literal("week")),
        rows: v.array(v.object({ userId: v.id("users"), name: v.string(), isMe: v.boolean(), chance: v.number(), finishChance: v.number(), projected: v.number() })),
        /** The chance nobody clears all five and every stake goes back; with the rows it sums to 1. */
        nobody: v.number(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx);
    const league = await ctx.db.get("leagues", args.leagueId);
    const week = await currentWeek(ctx, args.leagueId);
    if (league === null || week === null) return null;
    const members = await membersInJoinOrder(ctx, args.leagueId);
    if (!members.some((member) => member.userId === caller._id)) return null;

    const standings = await leagueStandings(ctx, args.leagueId, week._id);
    const { replays, asOf } = await loadMarket(ctx, args.leagueId, week, standings);
    const mine = replays.find((replay) => replay.standing.userId === caller._id);
    if (mine === undefined) return null;
    const atNow = replays.map((replay) => stateAt(replay, asOf, week));

    let matchup = null;
    const opponentId = await opponentInWeek(ctx, week._id, caller._id);
    const theirs = replays.find((replay) => replay.standing.userId === opponentId);
    if (theirs !== undefined) {
      // A step chart: the week's opening price, then one point per verified proof on either side.
      const moments = [week.startsAt, ...verifiedMoments([mine, theirs], asOf), asOf];
      const history: HistoryPoint[] = [...new Set(moments)].map((at) => ({ at, chance: matchupChanceAt(mine, theirs, at, week) }));
      matchup = {
        opponentId: theirs.standing.userId,
        opponentName: theirs.standing.name,
        chance: history[history.length - 1].chance,
        deltaToday: deltaSince(history, startOfPacificDay(pacificDay(asOf))),
        history,
        opponent: toRange(atNow[replays.indexOf(theirs)].projection),
      };
    }

    // The payout runs the real settlement rule (lib/projection.ts), so the card can't promise a split settlement won't pay.
    const payoutAt = (at: number) => {
      const states = at === asOf ? atNow : replays.map((replay) => stateAt(replay, at, week));
      return projectPayout({
        stakeUsd: league.stakeUsd,
        userId: caller._id,
        daysLeft: (week.endsAt - at) / DAY_MS,
        members: replays.map((replay, i) => ({
          userId: replay.standing.userId,
          paid: replay.standing.paid,
          points: states[i].projection.confirmed,
          slotsCleared: states[i].slotsCleared,
        })),
      });
    };
    const net = (cents: number, stakeCents: number) => (cents - stakeCents) / 100;
    const payoutNow = payoutAt(asOf);
    const sparkline = [...new Set(thin([week.startsAt, ...verifiedMoments(replays, asOf)], SPARKLINE_POINTS - 1).concat(asOf))];
    const payoutHistory = sparkline.map((at) => {
      const projection = payoutAt(at);
      return { at, netUsd: projection.eligible ? net(projection.expectedCents, projection.stakeCents) : 0 };
    });

    // A season-payout league settles once, at the season's end, so this week has no pot of its own to price.
    const staked = league.stakeUsd > 0 && resolveSettings(league).payout !== "season";
    const sim = simulatePot(
      atNow.map((state, i) => ({
        inPot: replays[i].standing.paid,
        confirmed: state.projection.confirmed,
        clearedSlots: state.slotsCleared,
        open: state.open,
        chance: state.chance,
      })),
    );
    const chances = staked ? sim.pot : sim.top;
    const odds = {
      kind: staked ? ("pot" as const) : ("week" as const),
      rows: replays
        .map((replay, i) => ({
          userId: replay.standing.userId,
          name: replay.standing.name,
          isMe: replay === mine,
          chance: chances[i],
          finishChance: sim.finish[i],
          projected: Math.round(atNow[i].projection.mean),
        }))
        .sort((a, b) => b.chance - a.chance || b.projected - a.projected || a.name.localeCompare(b.name)),
      nobody: staked ? sim.nobody : 0,
    };

    return {
      asOf,
      endsAt: week.endsAt,
      me: toRange(atNow[replays.indexOf(mine)].projection),
      matchup,
      payout: {
        // Once settled the payout is a fact, not a projection; the leaderboards strip says "Won" or "Lost" instead.
        eligible: staked && payoutNow.eligible && week.status !== "settled",
        stakeUsd: league.stakeUsd,
        expectedNetUsd: net(payoutNow.expectedCents, payoutNow.stakeCents),
        lowNetUsd: net(payoutNow.lowCents, payoutNow.stakeCents),
        highNetUsd: net(payoutNow.highCents, payoutNow.stakeCents),
        potChance: sim.pot[replays.indexOf(mine)],
        history: payoutHistory,
      },
      odds,
    };
  },
});
