import { formatScore } from "@/lib/taskText";

/** The fields of a feed.list item the live toast reads. */
export type LiveFeedItem = {
  proofId: string;
  user: { _id: string; name: string };
  taskTitle: string;
  points: number;
};

/**
 * The feed items that arrived between two results of the same live feed query, oldest first, so
 * toasts play in the order the proofs verified. Nothing is news on first load (before is
 * undefined) or while the query reloads (after is undefined), and the viewer's own proofs never
 * are: they just watched the verdict land.
 */
export function newLeagueEvents<T extends LiveFeedItem>(
  before: readonly T[] | undefined,
  after: readonly T[] | undefined,
  viewerId: string | undefined,
): T[] {
  if (!before || !after || !viewerId) return [];
  const seen = new Set(before.map((item) => item.proofId));
  // feed.list is newest first.
  return after.filter((item) => !seen.has(item.proofId) && item.user._id !== viewerId).reverse();
}

/** "Sam +40 · Leg day": who, how many points, for what. */
export function liveToastText(item: LiveFeedItem): string {
  const firstName = item.user.name.trim().split(/\s+/)[0] || item.user.name;
  return `${firstName} +${formatScore(item.points)} · ${item.taskTitle}`;
}
