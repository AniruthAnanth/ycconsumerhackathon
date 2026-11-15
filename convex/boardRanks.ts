/**
 * Ranked indexes for the leaderboards, kept in the @convex-dev/aggregate
 * component. Each board that ranks one stored number has its own sorted tree,
 * so the top of a board, a player's place and the size of a board are
 * O(log n) reads however many players there are, instead of a sort over every
 * row.
 *
 * Trees (namespace -> what is in it):
 *   [metric, leagueId, 0]          one entry per member of a league, from their
 *                                  all-time row: the All-Time, slot, streak,
 *                                  proof and quick-time boards.
 *   ["points", "global", weekStart] one entry per stored row in every league:
 *                                  the Global boards (weekStart 0 is all-time).
 *
 * The trees mirror the `scores` table and nothing else writes them: every
 * write to `scores` goes through leaderboards.ts's `store` and `removeRow`,
 * which call `syncRanks` in the same transaction. `backfill` rebuilds the
 * trees from `scores` for a deployment whose rows predate them.
 */
import { DirectAggregate } from "@convex-dev/aggregate";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { ScoreStats } from "./lib/weekTally";

/** weekStart of a player's all-time row in a league (leaderboards.ts). */
const ALL_TIME = 0;

/** Every number a ranked tree sorts by. */
export const METRICS = {
  points: { order: "desc", value: (stats: ScoreStats) => stats.points },
  body: { order: "desc", value: (stats: ScoreStats) => stats.slotPoints.body },
  mind: { order: "desc", value: (stats: ScoreStats) => stats.slotPoints.mind },
  recharge: { order: "desc", value: (stats: ScoreStats) => stats.slotPoints.recharge },
  chores: { order: "desc", value: (stats: ScoreStats) => stats.slotPoints.chores },
  people: { order: "desc", value: (stats: ScoreStats) => stats.slotPoints.people },
  streak: { order: "desc", value: (stats: ScoreStats) => stats.streak },
  // Nobody is ranked for a proof they have not made, or a drop they did not answer.
  highlight: { order: "desc", value: (stats: ScoreStats) => (stats.bestHighlight > 0 ? stats.bestHighlight : undefined) },
  quickTime: { order: "asc", value: (stats: ScoreStats) => stats.fastestQuickTimeSec },
} satisfies Record<string, { order: "asc" | "desc"; value: (stats: ScoreStats) => number | undefined }>;
export type Metric = keyof typeof METRICS;

type Namespace = [metric: Metric, scope: Id<"leagues"> | "global", weekStart: number];
/**
 * Best first in ascending key order: the metric (negated where more is
 * better), then slots cleared, the standings' own tiebreak.
 */
type Key = [value: number, slotsCleared: number];

const ranks = new DirectAggregate<{ Namespace: Namespace; Key: Key; Id: Id<"scores"> }>(components.boardRanks);

type Entry = { namespace: Namespace; key: Key };

/** The tree entries one stored row belongs in. */
function entriesOf(row: Doc<"scores">): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  // Convex orders -0 apart from 0, so a negated zero would never be found again.
  const negate = (n: number) => (n === 0 ? 0 : -n);
  const add = (namespace: Namespace, metric: Metric) => {
    const value = METRICS[metric].value(row.now);
    if (value === undefined) return;
    entries.set(JSON.stringify(namespace), {
      namespace,
      key: [METRICS[metric].order === "desc" ? negate(value) : value, negate(row.now.slotsCleared)],
    });
  };
  add(["points", "global", row.weekStart], "points");
  if (row.weekStart === ALL_TIME) {
    for (const metric of Object.keys(METRICS) as Metric[]) add([metric, row.leagueId, ALL_TIME], metric);
  }
  return entries;
}

/**
 * Moves a stored row's tree entries from `before` to `after`: null for a row
 * that did not exist, or no longer does. Idempotent, so a row whose entries
 * were never written (before `backfill` ran) is simply inserted.
 */
export async function syncRanks(
  ctx: MutationCtx,
  before: Doc<"scores"> | null,
  after: Doc<"scores"> | null,
): Promise<void> {
  const id = (after ?? before)?._id;
  if (id === undefined) return;
  const old = before === null ? new Map<string, Entry>() : entriesOf(before);
  const next = after === null ? new Map<string, Entry>() : entriesOf(after);
  for (const [name, entry] of old) {
    if (!next.has(name)) await ranks.deleteIfExists(ctx, { ...entry, id });
  }
  for (const [name, entry] of next) {
    const current = old.get(name);
    if (current === undefined) {
      await ranks.insertIfDoesNotExist(ctx, { ...entry, id });
    } else if (JSON.stringify(current.key) !== JSON.stringify(entry.key)) {
      await ranks.replaceOrInsert(ctx, { ...current, id }, entry);
    }
  }
}

/**
 * The ids of a tree's rows, best first: at most `limit` of them. One read of
 * the tree's top, whatever its size.
 */
export async function topOf(
  ctx: Parameters<typeof ranks.paginate>[0],
  namespace: Namespace,
  limit: number,
): Promise<Id<"scores">[]> {
  const { page } = await ranks.paginate(ctx, { namespace, pageSize: limit });
  return page.map((item) => item.id);
}

/** How many rows a tree holds: the size of a board, without reading it. */
export async function sizeOf(ctx: Parameters<typeof ranks.count>[0], namespace: Namespace): Promise<number> {
  return await ranks.count(ctx, { namespace });
}

/** A row's 0-based place in a tree: the number of rows ranked strictly ahead of it, plus level ones listed first. */
export async function placeOf(ctx: Parameters<typeof ranks.indexOf>[0], row: Doc<"scores">, metric: Metric, scope: Id<"leagues"> | "global"): Promise<number | null> {
  const entry = entriesOf(row).get(JSON.stringify([metric, scope, scope === "global" ? row.weekStart : ALL_TIME]));
  if (entry === undefined) return null;
  return await ranks.indexOf(ctx, entry.key, { namespace: entry.namespace, id: row._id });
}

const BACKFILL_PAGE = 100;

/**
 * Writes the tree entries of every stored row, a page at a time, each page
 * scheduling the next. Run once on a deployment whose `scores` rows predate
 * the trees: `npx convex run boardRanks:backfill '{}'`. Safe to run again.
 */
export const backfill = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("scores").paginate({ cursor: cursor ?? null, numItems: BACKFILL_PAGE });
    for (const row of page.page) await syncRanks(ctx, null, row);
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.boardRanks.backfill, { cursor: page.continueCursor });
    return null;
  },
});
