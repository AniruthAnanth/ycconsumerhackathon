import { CORE_SLOTS, SWEEP_BONUS } from "./scoring";

/**
 * Market-style odds for a league week, as pure functions: the chance to win a matchup, a
 * projected final score with a range, and each member's chance to win the pot.
 *
 * The model is deliberately small enough to explain on one screen. Each open task finishes
 * independently with a chance that comes from the player's own history and the time left in the
 * week; a player's final score is then confirmed points plus a sum of those coin flips, which we
 * treat as normal. Two normals give a matchup chance in closed form, and the chance to win the
 * pot comes from a seeded simulation of the rest of the week, so a query returns the same numbers every
 * time it runs.
 */

/** A new player's completion rate before they have any history: most drafted tasks get done. */
export const PRIOR_COMPLETION_RATE = 0.6;
/** How many past tasks the prior is worth. A player's own record outweighs it after a week or two. */
export const PRIOR_WEIGHT_TASKS = 5;
/** z for an 80% band: the range shows where the score lands four weeks in five. */
const RANGE_Z = 1.2816;
/** A score with no open tasks still gets this much spread, so two finished players tie at 50/50 rather than dividing by zero. */
const MIN_SPREAD_POINTS = 0.5;

/** The share of a player's past tasks they verified, pulled toward the prior while the record is short. */
export function completionRate(verified: number, total: number): number {
  return (verified + PRIOR_COMPLETION_RATE * PRIOR_WEIGHT_TASKS) / (total + PRIOR_WEIGHT_TASKS);
}

/**
 * The chance an open task still gets done, given the player finishes `rate` of their tasks over a
 * week at an even pace and `fractionLeft` of the week remains. By Bayes: of the tasks not done
 * yet, the ones that will be done are those scheduled for the time left,
 * rate x left / (1 - rate x elapsed).
 */
export function remainingChance(rate: number, fractionLeft: number): number {
  const left = clamp01(fractionLeft);
  const r = clamp01(rate);
  if (left === 0 || r === 0) return 0;
  return (r * left) / (1 - r * (1 - left));
}

export type ScoreProjection = {
  confirmed: number;
  /** Expected final score. */
  mean: number;
  /** Standard deviation of the final score. */
  sd: number;
  /** The 80% band, held between what is banked and what every open task would add. */
  low: number;
  high: number;
};

/**
 * A player's final score: confirmed points plus each open task's value times its chance.
 * Each task is a Bernoulli, so the variance is the sum of chance x (1 - chance) x value squared.
 */
export function projectScore(input: { confirmed: number; openValues: readonly number[]; chance: number }): ScoreProjection {
  const { confirmed, openValues } = input;
  const q = clamp01(input.chance);
  const ceiling = openValues.reduce((sum, value) => sum + value, 0);
  const mean = confirmed + q * ceiling;
  const sd = Math.sqrt(openValues.reduce((sum, value) => sum + q * (1 - q) * value * value, 0));
  return {
    confirmed,
    mean,
    sd,
    low: Math.max(confirmed, Math.round(mean - RANGE_Z * sd)),
    high: Math.min(confirmed + ceiling, Math.round(mean + RANGE_Z * sd)),
  };
}

/** The standard normal CDF (Abramowitz and Stegun 7.1.26, accurate to about 1e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** P(mine finishes ahead of theirs): the difference of two normals is normal, so it is one CDF. */
export function winChance(mine: ScoreProjection, theirs: ScoreProjection): number {
  const spread = Math.hypot(Math.max(mine.sd, MIN_SPREAD_POINTS), Math.max(theirs.sd, MIN_SPREAD_POINTS));
  return normalCdf((mine.mean - theirs.mean) / spread);
}

/** Draws in the pot simulation: enough that a chance moves by well under a point between runs of a different seed. */
export const POT_DRAWS = 2000;

export type PotEntrant = {
  /** False for a member who hasn't paid in: they still score but can't take the pot. */
  inPot: boolean;
  confirmed: number;
  /** Core slots already cleared. */
  clearedSlots: number;
  /** Each open task's value, and the core slot it would clear for the first time, if any. */
  open: readonly { value: number; clearsSlot?: string }[];
  /** The chance each open task still lands (remainingChance). */
  chance: number;
};

export type PotOdds = {
  /** Each entrant's chance to win the pot: to finish the week as the top-scoring player who cleared all five slots. */
  pot: number[];
  /** The chance nobody in the pot clears all five, so every stake goes back. pot plus nobody sums to exactly 1. */
  nobody: number;
  /** Each entrant's chance of the week's top score, finished or not; sums to 1. Free leagues rank by this. */
  top: number[];
  /** Each entrant's chance to clear all five slots. */
  finish: number[];
};

/**
 * The week played out POT_DRAWS times. In each draw every open task lands or doesn't with its
 * chance, which settles who clears all five slots and what everyone scores; the pot goes to the
 * top-scoring finisher (ties split). Finishing and scoring come from the same draw, so a player who
 * needs every task to finish also scores more when they do. A fixed seed keeps the query
 * deterministic, which Convex requires and which keeps the numbers from flickering.
 */
export function simulatePot(entrants: readonly PotEntrant[], draws = POT_DRAWS, seed = 0x5eed): PotOdds {
  const random = mulberry32(seed);
  const pot = entrants.map(() => 0);
  const top = entrants.map(() => 0);
  const finish = entrants.map(() => 0);
  let nobody = 0;
  const scores = entrants.map(() => 0);
  const finished = entrants.map(() => false);
  for (let draw = 0; draw < draws; draw++) {
    entrants.forEach((entrant, i) => {
      const slots = new Set<string>();
      let score = entrant.confirmed;
      for (const task of entrant.open) {
        if (random() >= entrant.chance) continue;
        score += task.value;
        if (task.clearsSlot !== undefined) slots.add(task.clearsSlot);
      }
      const done = entrant.clearedSlots + slots.size >= CORE_SLOTS.length;
      // The sweep bonus lands with the fifth slot; a player who had already swept has it in confirmed.
      scores[i] = score + (done && entrant.clearedSlots < CORE_SLOTS.length ? SWEEP_BONUS : 0);
      finished[i] = done;
      if (done) finish[i] += 1;
    });
    shareTop(scores, () => true, top);
    if (!shareTop(scores, (i) => finished[i] && entrants[i].inPot, pot)) nobody += 1;
  }
  const share = (counts: number[]) => counts.map((count) => count / draws);
  return { pot: share(pot), nobody: nobody / draws, top: share(top), finish: share(finish) };
}

/** Adds one draw's win to the highest score among `eligible` entrants, split on a tie. False when nobody was eligible. */
function shareTop(scores: readonly number[], eligible: (i: number) => boolean, into: number[]): boolean {
  let best = -Infinity;
  const leaders: number[] = [];
  scores.forEach((score, i) => {
    if (!eligible(i)) return;
    if (score > best) {
      best = score;
      leaders.length = 0;
    }
    if (score === best) leaders.push(i);
  });
  for (const i of leaders) into[i] += 1 / leaders.length;
  return leaders.length > 0;
}

/** A small seeded PRNG (mulberry32): the same seed always gives the same stream. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type HistoryPoint = { at: number; chance: number };

/** Percentage points the chance moved since the start of `dayStart`: the "+14 today" chip. */
export function deltaSince(history: readonly HistoryPoint[], dayStart: number): number {
  if (history.length === 0) return 0;
  const latest = history[history.length - 1];
  const before = [...history].reverse().find((point) => point.at < dayStart) ?? history[0];
  return Math.round(latest.chance * 100) - Math.round(before.chance * 100);
}

/** Keeps the first and last points and an even spread between, so a busy week stays a cheap sparkline. */
export function thin<T>(points: readonly T[], max: number): T[] {
  if (points.length <= max) return [...points];
  const picked: T[] = [];
  for (let i = 0; i < max; i++) picked.push(points[Math.round((i * (points.length - 1)) / (max - 1))]);
  return picked;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
