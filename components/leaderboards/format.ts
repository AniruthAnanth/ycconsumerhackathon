import type { BoardRow, Projection } from "./types";

/** 1 -> "1st", 12 -> "12th", 22 -> "22nd". The teens are the exception: 11th, 12th, 13th. */
export function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

export function formatUsdWithCents(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export type MovementMark = { text: string; tone: "up" | "down" | "flat" };

export function movementMark(movement: number): MovementMark {
  if (movement > 0) return { text: `▲${movement}`, tone: "up" };
  if (movement < 0) return { text: `▼${-movement}`, tone: "down" };
  return { text: "–", tone: "flat" };
}

/** Ranks that more than one row holds: the table shows them as "T2", the way a league table marks a tie. */
export function tiedRanks(rows: readonly Pick<BoardRow, "rank">[]): Set<number> {
  const seen = new Set<number>();
  const tied = new Set<number>();
  for (const { rank } of rows) {
    if (seen.has(rank)) tied.add(rank);
    seen.add(rank);
  }
  return tied;
}

/** The grey line under a name: how far behind, then what the score is made of. */
export function rowSubtitle(row: Pick<BoardRow, "gapLabel" | "detail">): string {
  return [row.gapLabel, row.detail].filter(Boolean).join(" · ");
}

/** "2nd · 15 behind Maya" or "1st · 15 ahead of Sam". Undefined until the caller has a row. */
export function placeLabel(rows: readonly BoardRow[]): string | undefined {
  const me = rows.find((row) => row.isMe);
  if (!me) return undefined;
  return [ordinal(me.rank), me.gapLabel].filter(Boolean).join(" · ");
}

/**
 * The projection query takes the time so the server never reads its clock; rounding
 * to the hour keeps the argument stable, and so the result cached, between renders.
 */
export function hourStart(now: number): number {
  return Math.floor(now / 3_600_000) * 3_600_000;
}

/** Green only for a paid-up player expected to come out ahead; breaking even is not a gain. The label is a sentence and is never parsed. */
export function isProjectedGain(projection: Pick<Projection, "eligible" | "expectedUsd" | "stakeUsd">): boolean {
  return projection.eligible && projection.expectedUsd > projection.stakeUsd;
}

/**
 * The payout behind the projection: what the player would be paid if the week
 * ended now, and the range it can still land in. Once every case is the same
 * amount the week is decided, and only that amount is worth saying.
 */
export function projectionDetail(projection: Pick<Projection, "ifEndedNowUsd" | "lowUsd" | "highUsd">): string {
  const now = formatUsdWithCents(projection.ifEndedNowUsd);
  if (projection.lowUsd === projection.highUsd) return `Paid out ${now}`;
  return `If it ended now you'd be paid ${now} · Range ${formatUsdWithCents(projection.lowUsd)} to ${formatUsdWithCents(projection.highUsd)}`;
}
