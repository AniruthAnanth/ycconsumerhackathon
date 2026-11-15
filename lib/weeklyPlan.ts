type PlanRow = { points: number; status: "open" | "verified" | "held" | "failed"; score: number | null };

export type PlanProgress = {
  /** Points from verified tasks. */
  confirmed: number;
  /** The locked lineup's maximum: every task's points. */
  possible: number;
  /** Points of proofs held for review. They never fill the bar until the referee accepts them. */
  pending: number;
  /** confirmed / possible, clamped to 0..1, and 0 for an empty lineup. */
  ratio: number;
};

/** The Roster hero's "Your weekly plan" bar, from the roster rows alone so it cannot disagree with them. */
export function planProgress(rows: readonly PlanRow[]): PlanProgress {
  let confirmed = 0;
  let possible = 0;
  let pending = 0;
  for (const row of rows) {
    possible += row.points;
    if (row.status === "verified") confirmed += row.score ?? 0;
    if (row.status === "held") pending += row.points;
  }
  const ratio = possible > 0 ? Math.min(Math.max(confirmed / possible, 0), 1) : 0;
  return { confirmed, possible, pending, ratio };
}

/** One label a screen reader reads for the whole bar. */
export function planProgressLabel({ confirmed, possible, pending, ratio }: PlanProgress): string {
  const base = `${confirmed} of ${possible} confirmed points, ${Math.round(ratio * 100)} percent`;
  return pending > 0 ? `${base}; ${pending} pending review` : base;
}
