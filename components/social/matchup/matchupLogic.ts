import { formatClock } from "@/lib/taskText";

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

/** What a side could score this week: the points on offer across its lineup rows. */
export function possiblePoints(rows: { mine?: Pick<TaskRow, "points">; theirs?: Pick<TaskRow, "points"> }[], side: "mine" | "theirs") {
  return rows.reduce((sum, row) => sum + (row[side]?.points ?? 0), 0);
}

/** The grey line under a task title. A held task has its points on hold while the league votes on a challenge. */
export function statusLine(task: Pick<TaskRow, "status" | "verifiedAt" | "dueLabel">) {
  switch (task.status) {
    case "verified":
      return task.verifiedAt === undefined ? "Verified" : `Verified ${formatClock(task.verifiedAt)}`;
    case "open":
      return task.dueLabel;
    case "held":
      return "Under review";
    case "failed":
      return "Not verified";
  }
}
