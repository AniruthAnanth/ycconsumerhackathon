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

/** "2:14 PM", in the device's time zone. Formatted by hand because Intl pads AM/PM with a narrow no-break space on some engines. */
export function clockTime(timestamp: number) {
  const date = new Date(timestamp);
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getHours() % 12 || 12}:${minutes} ${date.getHours() < 12 ? "AM" : "PM"}`;
}

/** The grey line under a task title. A held task has its points on hold while the league votes on a challenge. */
export function statusLine(task: Pick<TaskRow, "status" | "verifiedAt" | "dueLabel">) {
  switch (task.status) {
    case "verified":
      return task.verifiedAt === undefined ? "Verified" : `Verified ${clockTime(task.verifiedAt)}`;
    case "open":
      return task.dueLabel;
    case "held":
      return "Under review";
    case "failed":
      return "Not verified";
  }
}
