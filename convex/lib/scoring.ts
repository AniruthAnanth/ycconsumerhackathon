/**
 * Lineup's scoring rules as pure functions (SPEC.md section 2).
 *
 * Nothing here reads the database. convex/standings.ts loads a player's week and feeds it in,
 * which is what lets standings be recomputed inside a reactive query whenever a proof lands
 * instead of being stored.
 */

export const CORE_SLOTS = ["body", "mind", "recharge", "chores", "people"] as const;
export type CoreSlot = (typeof CORE_SLOTS)[number];
export type Slot = CoreSlot | "flex";
export type TaskStatus = "open" | "verified" | "held" | "failed";
/** "mystery" is the source of tasks stored before the daily mystery task was removed. */
export type TaskSource = "draft" | "flex" | "drop" | "mystery" | "group";

export const TASK_POINTS_MIN = 10;
export const TASK_POINTS_MAX = 50;
export const SLOT_CLEARED_BONUS = 25;
export const SWEEP_BONUS = 100;
export const STREAK_BONUS_PER_DAY = 5;
export const STREAK_BONUS_DAILY_CAP = 25;
export const MATCHUP_WIN_BONUS = 50;
export const FIRST_FINISHER_BONUS = 10;
export const GROUP_BONUS_PER_ATTENDEE = 5;
export const GROUP_BONUS_CAP = 25;

/**
 * Everything the rules need to know about one task.
 *
 * `points` is final. For the two bonus sources, convex/drops.ts writes the result of
 * quickTimeScore or groupSessionScore into it at the moment the bonus is earned, so reading a
 * score never has to look a drop up, and no bonus can be counted twice.
 */
export type ScorableTask = {
  slot: Slot;
  points: number;
  status: TaskStatus;
  source: TaskSource;
};

/** A task is worth 10 to 50 points. The draft model picks within that; this holds it to the range. */
export function clampTaskPoints(points: number): number {
  if (!Number.isFinite(points)) return TASK_POINTS_MIN;
  return Math.min(TASK_POINTS_MAX, Math.max(TASK_POINTS_MIN, Math.round(points)));
}

/** A quick-time drop pays its own points, plus 10 to whoever finished first. */
export function quickTimeScore(points: number, firstFinisher: boolean): number {
  return points + (firstFinisher ? FIRST_FINISHER_BONUS : 0);
}

/** A group session pays the task's points plus 5 for each other attendee, capped at +25. */
export function groupSessionScore(points: number, otherAttendees: number): number {
  return points + Math.min(GROUP_BONUS_CAP, GROUP_BONUS_PER_ATTENDEE * Math.max(0, otherAttendees));
}

/**
 * The points a task contributes right now, or null while it contributes nothing.
 *
 * A verified task pays its points. A failed task stored with negative points costs exactly
 * that: nothing writes one any more, but the penalties of the removed mystery task are still in
 * the table and still count. Everything else counts for nothing: an open task, a failed proof
 * that can still be retried, and a held task whose proof is under challenge until the vote closes.
 */
export function taskScore(task: ScorableTask): number | null {
  if (task.status === "verified") return task.points;
  if (task.status === "failed" && task.points < 0) return task.points;
  return null;
}

/**
 * The roster slots a player has cleared. Only the drafted lineup clears a slot, because clearing
 * all five is what protects the stake and bonus features must never affect it. The one exception
 * the rules name is a group session, which counts for both Body and People.
 */
export function clearedSlots(tasks: readonly ScorableTask[]): CoreSlot[] {
  const cleared = new Set<Slot>();
  for (const task of tasks) {
    if (task.status !== "verified") continue;
    if (task.source === "draft") cleared.add(task.slot);
    if (task.source === "group") cleared.add("body").add("people");
  }
  return CORE_SLOTS.filter((slot) => cleared.has(slot));
}

/** +25 for each cleared slot, and +100 more for a sweep of all five. */
export function slotBonus(clearedCount: number): number {
  return clearedCount * SLOT_CLEARED_BONUS + (clearedCount >= CORE_SLOTS.length ? SWEEP_BONUS : 0);
}

/** For each distinct day in ascending order, how many consecutive days the run ending there is. */
function runLengths(days: readonly number[]): { day: number; run: number }[] {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const runs: { day: number; run: number }[] = [];
  for (const day of sorted) {
    const previous = runs[runs.length - 1];
    runs.push({ day, run: previous && previous.day === day - 1 ? previous.run + 1 : 1 });
  }
  return runs;
}

/**
 * Streak points for a set of days that each had a verified proof (see `pacificDay` in week.ts).
 * Day n of an unbroken run pays 5n, capped at 25 a day.
 */
export function streakBonus(proofDays: readonly number[]): number {
  return runLengths(proofDays).reduce(
    (sum, { run }) => sum + Math.min(STREAK_BONUS_DAILY_CAP, STREAK_BONUS_PER_DAY * run),
    0,
  );
}

/**
 * The streak a player is on: consecutive proof days up to today. Yesterday still counts as
 * alive, because today's proof may be yet to come.
 */
export function currentStreak(proofDays: readonly number[], today: number): number {
  const runs = runLengths(proofDays.filter((day) => day <= today));
  const latest = runs[runs.length - 1];
  return latest && latest.day >= today - 1 ? latest.run : 0;
}

/** The longest unbroken run of proof days. */
export function longestStreak(proofDays: readonly number[]): number {
  return runLengths(proofDays).reduce((longest, { run }) => Math.max(longest, run), 0);
}

export type WeekScore = {
  /** Sum of every task's own score, stored penalties included. */
  taskPoints: number;
  slotsCleared: number;
  slotBonus: number;
  streakBonus: number;
  /** Everything above. The matchup bonus is added only once the week settles. */
  total: number;
  /** Cleared all five slots, which is what keeps the stake at settlement. */
  finisher: boolean;
};

/** One player's week: their tasks, and the days on which they had a verified proof. */
export function scoreWeek(tasks: readonly ScorableTask[], proofDays: readonly number[]): WeekScore {
  const taskPoints = tasks.reduce((sum, task) => sum + (taskScore(task) ?? 0), 0);
  const slotsCleared = clearedSlots(tasks).length;
  const slots = slotBonus(slotsCleared);
  const streak = streakBonus(proofDays);
  return {
    taskPoints,
    slotsCleared,
    slotBonus: slots,
    streakBonus: streak,
    total: taskPoints + slots + streak,
    finisher: slotsCleared === CORE_SLOTS.length,
  };
}

/** +50 to the higher scorer of a head-to-head pair at settlement. A tie pays nobody. */
export function matchupBonus(mine: number, theirs: number): number {
  return mine > theirs ? MATCHUP_WIN_BONUS : 0;
}

/**
 * The chance, from 0 to 1, that `mine` finishes ahead of `theirs`. Each side is projected as
 * its total so far plus half the points still open on its roster, and the chance is that side's
 * share of the two projections. It is a scoreboard flourish, not a forecast.
 */
export function winProbability(
  mine: { total: number; openPoints: number },
  theirs: { total: number; openPoints: number },
): number {
  const project = (side: { total: number; openPoints: number }) => Math.max(0, side.total + side.openPoints / 2);
  const both = project(mine) + project(theirs);
  if (both === 0) return 0.5;
  return Math.min(0.99, Math.max(0.01, Math.round((project(mine) / both) * 100) / 100));
}
