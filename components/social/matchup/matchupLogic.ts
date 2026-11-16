
import type { TaskRow } from "../contract";

const clampProbability = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/**
 * How the win-probability bar is cut. The sides should already sum to 1, but a
 * bad or missing value must never leave the bar empty, so both fall back to even.
 * The labels derive one from the other so they always add up to 100.
 */
export function winBarSplit(mine: number, theirs: number) {
  const mineClamped = clampProbability(mine);
  const theirsClamped = clampProbability(theirs);
  const sum = mineClamped + theirsClamped;
  const mineShare = sum === 0 ? 0.5 : mineClamped / sum;
  const minePercent = Math.round(mineShare * 100);
  return { mineShare, minePercent, theirsPercent: 100 - minePercent };
}

type PossibleRow = Pick<TaskRow, "points" | "status">;

/**
 * The most a side can still end the week on: what it has banked plus the points on its open rows.
 * Banked points can include more than the lineup's face value, so summing the rows alone could read
 * "150 of 120 possible".
 */
export function possiblePoints(rows: { mine?: PossibleRow; theirs?: PossibleRow }[], side: "mine" | "theirs", total: number) {
  return rows.reduce((sum, row) => sum + (row[side]?.status === "open" ? row[side].points : 0), total);
}

/**
 * Points in a side's total that no lineup row shows: slot-cleared and streak bonuses, challenge
 * stakes and bench tasks. Shown as their own line so the rows and the bonus add up to the total.
 */
export function bonusPoints(rows: { mine?: Pick<TaskRow, "score">; theirs?: Pick<TaskRow, "score"> }[], side: "mine" | "theirs", total: number) {
  return rows.reduce((rest, row) => rest - (row[side]?.score ?? 0), total);
}

/** The grey line under a task title. A held task has its points on hold while the league votes on a challenge. */
export function statusLine(task: Pick<TaskRow, "status" | "dueLabel">) {
  switch (task.status) {
    case "verified":
      // No time: beside the score a clock time truncated on a phone, and the check says enough.
      return "Verified";
    case "open":
      return task.dueLabel;
    case "held":
      return "Up for veto";
    case "failed":
      return "Not verified";
  }
}
