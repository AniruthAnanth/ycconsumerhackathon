/**
 * Wrapped: the week's recap as five story cards (champion, best proof, biggest comeback, fastest
 * quick-time response, your week). Every card is computed on read from the week's tasks, proofs
 * and drops, and a card with nothing to show says so instead of inventing a winner.
 */
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { membersInJoinOrder } from "./leagues";
import { requireUser } from "./lib/auth";
import { leagueStandings } from "./standings";

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_STAT = "—";

// ---- Shapes -----------------------------------------------------------------------------------

type Media = { storageId: Id<"_storage">; mediaType: "photo" | "video" };

/** One verified task and the proof that earned it: the unit every card is built from. */
export type Entry = {
  userId: string;
  name: string;
  taskTitle: string;
  points: number;
  provedAt: number;
  highlight: number;
  confidence: number;
  caption: string;
  media?: Media;
  /** Set when the task answered a quick-time drop. */
  quickTime?: { title: string; opensAt: number };
};

/** A member's line in the week's table. */
export type Standing = { userId: string; name: string; points: number; slotsCleared: number };

export type CardKind = "champion" | "best_proof" | "comeback" | "fastest" | "your_week";
export type Card = { kind: CardKind; title: string; subtitle: string; stat: string; media?: Media };
/** A card as the app receives it: the stored file swapped for a URL it can show. */
type ServedCard = Omit<Card, "media"> & { mediaUrl?: string; mediaType?: Media["mediaType"] };

// ---- Rules (pure) -----------------------------------------------------------------------------

/** The referee's most feed-worthy proof; ties go to the one it was surer of, then the latest. */
export function bestProof(entries: Entry[]): Entry | null {
  const ranked = [...entries].sort(
    (a, b) => b.highlight - a.highlight || b.confidence - a.confidence || b.provedAt - a.provedAt,
  );
  return ranked[0] ?? null;
}

export function fastestQuickTime(entries: Entry[]): { entry: Entry; seconds: number } | null {
  let fastest: { entry: Entry; seconds: number } | null = null;
  for (const entry of entries) {
    if (!entry.quickTime) continue;
    const seconds = Math.max(0, Math.round((entry.provedAt - entry.quickTime.opensAt) / 1000));
    if (!fastest || seconds < fastest.seconds) fastest = { entry, seconds };
  }
  return fastest;
}

/** 1 for the leader; members level on points share a rank. */
function rankIn(totals: Map<string, number>, userId: string): number {
  const mine = totals.get(userId) ?? 0;
  return 1 + [...totals.values()].filter((points) => points > mine).length;
}

/**
 * The member who climbed furthest: from their worst end-of-day rank earlier in the week to where
 * they stand at the end of the latest day anyone scored. Ranks follow task points as they were
 * earned, day by day. Null when nobody finished above their worst day.
 */
export function biggestComeback(
  scores: Pick<Entry, "userId" | "points" | "provedAt">[],
  memberIds: string[],
  weekStart: number,
): { userId: string; from: number; to: number } | null {
  if (scores.length === 0) return null;
  const dayOf = (at: number) => Math.min(6, Math.max(0, Math.floor((at - weekStart) / DAY_MS)));
  const lastDay = Math.max(...scores.map((score) => dayOf(score.provedAt)));

  const totals = new Map(memberIds.map((id) => [id, 0]));
  const worstRank = new Map<string, number>();
  for (let day = 0; day <= lastDay; day++) {
    for (const score of scores) {
      if (dayOf(score.provedAt) === day) {
        totals.set(score.userId, (totals.get(score.userId) ?? 0) + score.points);
      }
    }
    if (day === lastDay) break;
    for (const id of memberIds) {
      worstRank.set(id, Math.max(worstRank.get(id) ?? 1, rankIn(totals, id)));
    }
  }

  let best: { userId: string; from: number; to: number } | null = null;
  for (const id of memberIds) {
    const climb = { userId: id, from: worstRank.get(id) ?? 1, to: rankIn(totals, id) };
    const beatsBest =
      !best || climb.from - climb.to > best.from - best.to ||
      (climb.from - climb.to === best.from - best.to && climb.to < best.to);
    if (climb.from > climb.to && beatsBest) best = climb;
  }
  return best;
}

export function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "42s", "3m 05s", "1h 12m": short enough to be a card's headline number. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/**
 * The week to recap when the app doesn't name one: the latest settled week, because the recap is
 * shown right after settlement even if the next week has already opened; before the first
 * settlement, the week in progress.
 */
export function pickWeek<W extends { number: number; status: "open" | "settled" }>(
  weeks: W[],
  weekNumber?: number,
): W | null {
  if (weekNumber !== undefined) return weeks.find((week) => week.number === weekNumber) ?? null;
  const newestFirst = [...weeks].sort((a, b) => b.number - a.number);
  return newestFirst.find((week) => week.status === "settled") ?? newestFirst[0] ?? null;
}

/** Always five cards, in story order, so the app can lay them out without checking what exists. */
export function buildCards(input: {
  standings: Standing[];
  entries: Entry[];
  viewerId: string;
  weekStart: number;
}): Card[] {
  const { standings, entries, viewerId, weekStart } = input;
  const byPoints = [...standings].sort((a, b) => b.points - a.points);
  const nameOf = (userId: string) => standings.find((s) => s.userId === userId)?.name ?? "Player";

  const [leader, runnerUp] = byPoints;
  const champion: Card =
    leader && leader.points > 0
      ? {
          kind: "champion",
          title: "League champion",
          subtitle: runnerUp
            ? `${leader.name} · ${leader.points - runnerUp.points} ahead of ${runnerUp.name}`
            : leader.name,
          stat: `${leader.points} pts`,
          media: bestProof(entries.filter((e) => e.userId === leader.userId))?.media,
        }
      : { kind: "champion", title: "League champion", subtitle: "Nobody has scored yet", stat: NO_STAT };

  const top = bestProof(entries);
  const best: Card = top
    ? {
        kind: "best_proof",
        title: "Best proof",
        subtitle: `${top.name} · ${top.caption || top.taskTitle}`,
        stat: `${top.highlight}/10`,
        media: top.media,
      }
    : { kind: "best_proof", title: "Best proof", subtitle: "No proofs yet this week", stat: NO_STAT };

  const climb = biggestComeback(entries, standings.map((s) => s.userId), weekStart);
  const comeback: Card = climb
    ? {
        kind: "comeback",
        title: "Biggest comeback",
        subtitle: `${nameOf(climb.userId)} climbed from ${ordinal(climb.from)} to ${ordinal(climb.to)}`,
        stat: `+${climb.from - climb.to}`,
        media: bestProof(entries.filter((e) => e.userId === climb.userId))?.media,
      }
    : { kind: "comeback", title: "Biggest comeback", subtitle: "Nobody has climbed the table yet", stat: NO_STAT };

  const quickest = fastestQuickTime(entries);
  const fastest: Card = quickest
    ? {
        kind: "fastest",
        title: "Fastest quick-time",
        subtitle: `${quickest.entry.name} · ${quickest.entry.quickTime?.title ?? quickest.entry.taskTitle}`,
        stat: formatDuration(quickest.seconds),
        media: quickest.entry.media,
      }
    : { kind: "fastest", title: "Fastest quick-time", subtitle: "Nobody answered a drop this week", stat: NO_STAT };

  const mine = standings.find((s) => s.userId === viewerId);
  const myEntries = entries.filter((e) => e.userId === viewerId);
  const yourWeek: Card = {
    kind: "your_week",
    title: "Your week",
    subtitle: `${mine?.slotsCleared ?? 0}/5 slots · ${myEntries.length} ${myEntries.length === 1 ? "proof" : "proofs"}`,
    stat: `${mine?.points ?? 0} pts`,
    media: bestProof(myEntries)?.media,
  };

  return [champion, best, comeback, fastest, yourWeek];
}

// ---- Query ------------------------------------------------------------------------------------

/** Bounds on reads, far above what one league-week holds. */
const MAX_WEEKS = 200;
const MAX_WEEK_TASKS = 50;
const MAX_WEEK_PROOFS = 300;

export const get = query({
  args: { leagueId: v.id("leagues"), weekNumber: v.optional(v.number()) },
  returns: v.object({
    cards: v.array(
      v.object({
        kind: v.union(
          v.literal("champion"),
          v.literal("best_proof"),
          v.literal("comeback"),
          v.literal("fastest"),
          v.literal("your_week"),
        ),
        title: v.string(),
        subtitle: v.string(),
        stat: v.string(),
        mediaUrl: v.optional(v.string()),
        mediaType: v.optional(v.union(v.literal("photo"), v.literal("video"))),
      }),
    ),
  }),
  handler: async (ctx, { leagueId, weekNumber }) => {
    const viewer = await requireUser(ctx);
    const [memberships, weeks] = await Promise.all([
      membersInJoinOrder(ctx, leagueId),
      ctx.db.query("weeks").withIndex("by_league", (q) => q.eq("leagueId", leagueId)).take(MAX_WEEKS),
    ]);
    const week = pickWeek(weeks, weekNumber);
    // No cards rather than an error: a recap of someone else's league, or of a week that never
    // happened, is simply empty.
    if (!week || !memberships.some((m) => m.userId === viewer._id)) return { cards: [] };

    const [entries, standings] = await Promise.all([
      Promise.all(memberships.map((m) => memberEntries(ctx, m.userId, leagueId, week.startsAt))),
      // The table's own numbers, so the champion here is the leader there: challenge points and,
      // once the week has settled, the matchup bonus are already in them.
      leagueStandings(ctx, leagueId, week._id),
    ]);
    const cards = buildCards({
      standings,
      entries: entries.flat(),
      viewerId: viewer._id,
      weekStart: week.startsAt,
    });

    return {
      cards: await Promise.all(
        cards.map(async ({ media, ...card }): Promise<ServedCard> => {
          const mediaUrl = media ? await ctx.storage.getUrl(media.storageId) : null;
          return mediaUrl && media ? { ...card, mediaUrl, mediaType: media.mediaType } : card;
        }),
      ),
    };
  },
});

/** One member's week in this league as card entries: each verified task with the proof that earned it. */
async function memberEntries(
  ctx: QueryCtx,
  userId: Id<"users">,
  leagueId: Id<"leagues">,
  weekStart: number,
): Promise<Entry[]> {
  const [user, tasks, proofs] = await Promise.all([
    ctx.db.get("users", userId),
    ctx.db
      .query("tasks")
      .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", weekStart))
      .take(MAX_WEEK_TASKS),
    ctx.db
      .query("proofs")
      .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", weekStart))
      .take(MAX_WEEK_PROOFS),
  ]);
  const name = user?.name ?? "Player";

  const entries: Entry[] = [];
  for (const task of tasks) {
    const drop = task.dropId ? await ctx.db.get("drops", task.dropId) : null;
    // A drop is one league's event: its result counts only there.
    if (drop && drop.leagueId !== leagueId) continue;
    // Held (under challenge) and reopened tasks earn nothing, so they are not part of the recap.
    if (task.status !== "verified") continue;
    // The newest passing proof is the one that verified the task; older ones were retries.
    const proof = proofs
      .filter((p) => p.taskId === task._id && p.pass)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!proof) continue;
    entries.push({
      userId,
      name,
      taskTitle: task.title,
      points: task.points,
      provedAt: proof.createdAt,
      highlight: proof.highlight,
      confidence: proof.confidence,
      caption: proof.caption,
      ...(proof.storageId && proof.mediaType !== "canvas"
        ? { media: { storageId: proof.storageId, mediaType: proof.mediaType } }
        : {}),
      ...(drop?.kind === "quicktime" ? { quickTime: { title: drop.title, opensAt: drop.opensAt } } : {}),
    });
  }
  return entries;
}
