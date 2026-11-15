/**
 * Market-style odds for a league week, as pure functions: the chance to win a matchup, a
 * projected final score with a range, and each member's chance to top the week.
 *
 * The model is deliberately small enough to explain on one screen. Each open task finishes
 * independently with a chance that comes from the player's own history and the time left in the
 * week; a player's final score is then confirmed points plus a sum of those coin flips, which we
 * treat as normal. Two normals give a matchup chance in closed form, and the chance to top the
 * whole league is one integral done on a fixed grid. No sampling, so a query returns the same
 * numbers every time it runs.
 */

/** A new player's completion rate before they have any history: most drafted tasks get done. */
export const PRIOR_COMPLETION_RATE = 0.6;
/** How many past tasks the prior is worth. A player's own record outweighs it after a week or two. */
export const PRIOR_WEIGHT_TASKS = 5;
/** z for an 80% band: the range shows where the score lands four weeks in five. */
const RANGE_Z = 1.2816;
/** A score with no open tasks still gets this much spread, so two finished players tie at 50/50 rather than dividing by zero. */
const MIN_SPREAD_POINTS = 0.5;
const GRID_STEPS = 400;

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

/**
 * Each player's chance of the top score: P(i is highest) = integral of i's density times every
 * rival's CDF, summed on a fixed grid and normalised so the field adds up to exactly 1.
 */
export function topChances(players: readonly ScoreProjection[]): number[] {
  if (players.length === 0) return [];
  if (players.length === 1) return [1];
  const sds = players.map((player) => Math.max(player.sd, MIN_SPREAD_POINTS));
  const from = Math.min(...players.map((player, i) => player.mean - 6 * sds[i]));
  const to = Math.max(...players.map((player, i) => player.mean + 6 * sds[i]));
  const step = (to - from) / GRID_STEPS;
  const sums = players.map(() => 0);
  for (let k = 0; k <= GRID_STEPS; k++) {
    const x = from + k * step;
    const cdfs = players.map((player, i) => normalCdf((x - player.mean) / sds[i]));
    players.forEach((player, i) => {
      const z = (x - player.mean) / sds[i];
      const density = Math.exp(-0.5 * z * z) / (sds[i] * Math.sqrt(2 * Math.PI));
      let others = 1;
      cdfs.forEach((cdf, j) => {
        if (j !== i) others *= cdf;
      });
      sums[i] += density * others * step;
    });
  }
  const total = sums.reduce((sum, value) => sum + value, 0);
  return total === 0 ? players.map(() => 1 / players.length) : sums.map((value) => value / total);
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
