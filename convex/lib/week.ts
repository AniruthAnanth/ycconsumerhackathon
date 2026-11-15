/**
 * Week maths for Lineup.
 *
 * A Lineup week runs Monday 00:00 to Sunday 23:59 in America/Los_Angeles, for every league.
 * `weekStart` is that Monday's midnight in epoch milliseconds. Tasks and proofs are keyed by it,
 * and every league's `weeks.startsAt` for the same week equals it.
 *
 * The Pacific offset comes from the US daylight-saving rule rather than from Intl, so this file
 * gives the same answer in Convex's runtime, in Node tests and in Hermes on a phone.
 */

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Midnight UTC of the nth Sunday (1-based) of a month. */
function nthSundayUtc(year: number, monthIndex: number, nth: number): number {
  const weekdayOfFirst = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay(); // 0 is Sunday
  const firstSunday = 1 + ((7 - weekdayOfFirst) % 7);
  return Date.UTC(year, monthIndex, firstSunday + 7 * (nth - 1));
}

/** Hours to add to UTC to get Pacific wall-clock time: -7 during daylight time, otherwise -8. */
export function pacificOffsetHours(ts: number): number {
  const year = new Date(ts).getUTCFullYear();
  // Daylight time starts at 2:00 PST (10:00 UTC) on the second Sunday of March
  // and ends at 2:00 PDT (09:00 UTC) on the first Sunday of November.
  const daylightStarts = nthSundayUtc(year, 2, 2) + 10 * HOUR_MS;
  const daylightEnds = nthSundayUtc(year, 10, 1) + 9 * HOUR_MS;
  return ts >= daylightStarts && ts < daylightEnds ? -7 : -8;
}

/** The instant shifted so that its UTC fields read as Pacific wall-clock time. */
export function pacificWallClock(ts: number): Date {
  return new Date(ts + pacificOffsetHours(ts) * HOUR_MS);
}

/**
 * The Pacific calendar day of an instant, as whole days since 1 January 1970.
 * Consecutive days differ by exactly one, which is all streak counting needs.
 */
export function pacificDay(ts: number): number {
  return Math.floor(pacificWallClock(ts).getTime() / DAY_MS);
}

/** Epoch milliseconds of 00:00 Pacific on a Pacific calendar day. */
export function startOfPacificDay(day: number): number {
  const midnightAsUtc = day * DAY_MS;
  // Real midnight is 7 or 8 hours later in UTC. Clocks change at 2:00, so the offset in force
  // at 8 hours past (00:00 or 01:00 Pacific) is the offset at midnight itself.
  return midnightAsUtc - pacificOffsetHours(midnightAsUtc + 8 * HOUR_MS) * HOUR_MS;
}

/** 0 for Monday through 6 for Sunday, in Pacific time. */
export function dayOfWeek(ts: number): number {
  // 1 January 1970 was a Thursday, three days after a Monday.
  return (((pacificDay(ts) + 3) % 7) + 7) % 7;
}

/** The Monday 00:00 Pacific at or before an instant: the key of the week it falls in. */
export function weekStartOf(ts: number): number {
  return startOfPacificDay(pacificDay(ts) - dayOfWeek(ts));
}

/** The instant a week stops: the following Monday 00:00 Pacific, which is the next weekStart. */
export function weekEndOf(weekStart: number): number {
  return startOfPacificDay(pacificDay(weekStart) + 7);
}

/** "Mon" through "Sun" for an instant, in Pacific time. */
export function weekdayLabel(ts: number): string {
  return WEEKDAY_LABELS[dayOfWeek(ts)];
}

/** A Pacific clock time such as "2:14 PM". */
export function clockLabel(ts: number): string {
  const wallClock = pacificWallClock(ts);
  const hours = wallClock.getUTCHours();
  const minutes = String(wallClock.getUTCMinutes()).padStart(2, "0");
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

/**
 * A week's pairs after `newcomer` joins mid-week. Head-to-heads already under way never change:
 * the newcomer either takes over the extra pair of an odd league, giving its left-over member a
 * real opponent, or becomes the left-over member of a now-odd league.
 * The extra pair is always stored last, left-over member first: `withStandIns` in lib/schedule.ts.
 *
 * Only the last pair differs from the input, replaced when the lengths match and appended otherwise.
 */
export function pairsAfterJoin<T>(
  pairs: readonly (readonly [T, T])[],
  membersBefore: readonly T[],
  newcomer: T,
): [T, T][] {
  const kept = pairs.map(([a, b]): [T, T] => [a, b]);
  if (membersBefore.length === 0) return kept;
  if (kept.length === 0) return [[membersBefore[0], newcomer]];
  if (membersBefore.length % 2 === 1) {
    const [leftOver] = kept[kept.length - 1];
    return [...kept.slice(0, -1), [leftOver, newcomer]];
  }
  return [...kept, [newcomer, kept[0][0]]];
}
