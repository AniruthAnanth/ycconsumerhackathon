import type { FeedChallenge, FeedItem, FeedReaction } from "@/components/social/contract";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
// Also the challenge window: CHALLENGE_WINDOW_MS in convex/challenges.ts, which the server enforces.
const DAY = 24 * HOUR;

/** The reactions every proof offers, in a fixed order so the buttons never move under a thumb. */
export const REACTION_EMOJI = ["🔥", "💪", "👏", "😂"];

/**
 * The buttons under a proof: the offered emoji first, with their counts, then
 * any other emoji the league used on it, such as one sent from another client.
 */
export function reactionButtons(reactions: FeedReaction[]): FeedReaction[] {
  const used = new Map(reactions.map((reaction) => [reaction.emoji, reaction]));
  const offered = REACTION_EMOJI.map((emoji) => used.get(emoji) ?? { emoji, count: 0, mine: false });
  return [...offered, ...reactions.filter((reaction) => !REACTION_EMOJI.includes(reaction.emoji))];
}

/** A proof can be challenged once, by another league member, within a day of being verified. */
export function canChallenge(
  item: Pick<FeedItem, "user" | "challenge" | "createdAt">,
  myUserId: string | undefined,
  now: number,
): boolean {
  return (
    item.challenge === undefined &&
    myUserId !== undefined &&
    item.user._id !== myUserId &&
    now - item.createdAt < DAY
  );
}

/** Legit's share of the vote bar, 0 to 1. The bar is even until the first vote, so neither side looks ahead. */
export function legitShare(legit: number, notLegit: number): number {
  const total = legit + notLegit;
  return total === 0 ? 0.5 : legit / total;
}

/** Compact age of a feed item: "now", "5m", "3h", "2d". */
export function timeAgo(then: number, now: number): string {
  const elapsed = Math.max(0, now - then);
  if (elapsed < MINUTE) return "now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  return `${Math.floor(elapsed / DAY)}d`;
}

/**
 * How long a vote stays open. "closing" covers the moment between the deadline and the server
 * settling it. Hours are rounded, not rounded up: the deadline is set by the server's clock, and
 * a phone a few seconds behind it would otherwise show a fresh 12-hour vote as "13h left".
 */
export function timeLeft(closesAt: number, now: number): string {
  const left = closesAt - now;
  if (left <= 0) return "closing";
  if (left < HOUR) return `${Math.ceil(left / MINUTE)}m left`;
  return `${Math.round(left / HOUR)}h left`;
}

/** Drop results and group photos are marked in the feed; an ordinary proof needs no label. */
export const KIND_LABEL: Record<FeedItem["kind"], string | undefined> = {
  proof: undefined,
  drop: "DROP",
  group: "GROUP SESSION",
};

/** What the vote bar says about where a challenge stands. */
export function challengeStatus(challenge: Pick<FeedChallenge, "status" | "closesAt">, now: number): string {
  if (challenge.status === "upheld") return "Upheld · points stand";
  if (challenge.status === "overturned") return "Overturned · task reopened";
  return `Points on hold · ${timeLeft(challenge.closesAt, now)}`;
}
