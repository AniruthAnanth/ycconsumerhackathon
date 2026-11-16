import type { FeedChallenge, FeedItem, FeedReaction } from "@/components/social/contract";
import type { Slot } from "@/lib/slots";
import { formatScore } from "@/lib/taskText";

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

/**
 * A proof can be challenged once, by another league member, within a day of being verified.
 * The server also refuses a challenge nobody could vote on (eligibleVoters in convex/challenges.ts
 * excludes the owner and the challenger), so a league needs three members before any proof qualifies.
 */
export function canChallenge(
  item: Pick<FeedItem, "user" | "challenge" | "createdAt">,
  myUserId: string | undefined,
  now: number,
  memberCount: number | undefined,
): boolean {
  return (
    memberCount !== undefined &&
    memberCount >= 3 &&
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

/** What the post's Share action sends: who did what for how many points, and the photo when there is one. */
export function proofShareText(
  item: Pick<FeedItem, "user" | "taskTitle" | "points" | "mediaUrl" | "mediaType">,
): string {
  const line = `${item.user.name} proved "${item.taskTitle}" for ${formatScore(item.points)} pts on Lineup.`;
  return item.mediaUrl && item.mediaType !== "canvas" ? `${line}\n${item.mediaUrl}` : line;
}

export type ProofVisual = { kind: "none" } | { kind: "media"; uri: string } | { kind: "filmstrip"; frames: string[] };

/**
 * What a post shows above its words: a timelapse's stills when it kept several, else the
 * proof's photo or clip, else nothing. A Canvas proof has no picture, so it reads as a
 * photo-less card.
 */
export function proofVisual(item: Pick<FeedItem, "mediaUrl" | "mediaType" | "frameUrls">): ProofVisual {
  if (item.mediaType === "canvas") return { kind: "none" };
  if (item.mediaType === "photo" && item.frameUrls && item.frameUrls.length > 1) {
    return { kind: "filmstrip", frames: item.frameUrls };
  }
  return item.mediaUrl ? { kind: "media", uri: item.mediaUrl } : { kind: "none" };
}

/** A caption the feed shows as is: the referee's own line, when it is short enough to read at a glance. */
export const MAX_CAPTION_WORDS = 8;

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** A few lines per slot, each well under eight words, so a fallback never reads like a sentence. */
const QUIPS: Record<Slot, string[]> = {
  body: ["Legs will file a complaint tomorrow.", "Sweat is just weakness leaving.", "Gravity lost this round.", "The couch misses you already."],
  mind: ["Brain cells reporting for duty.", "Smarter than an hour ago.", "Neurons did a little dance.", "Big brain energy, verified."],
  recharge: ["Battery back in the green.", "Doing nothing, done perfectly.", "Peak chill achieved.", "Rest is a skill. Mastered."],
  chores: ["You could eat off this counter.", "Mom would be proud.", "Chaos, firmly defeated.", "Adulting level: expert."],
  people: ["Friendship streak still alive.", "Social battery spent well.", "Someone's day just got better.", "Main character in their story too."],
  flex: ["Showed up. That's the flex.", "Off script and on point.", "Wildcard played perfectly.", "Nobody saw that coming."],
};

/** A stable small number from a string, so the same task always gets the same quip. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * A short, funny line for a proof whose own caption is missing or too long. A short task
 * title joins the slot's lines so the quip can name it ("Call mom: done and dusted.").
 */
export function quipFor(taskTitle: string, slot: Slot): string {
  const title = taskTitle.trim();
  const named = title && wordCount(title) <= 3 ? [`${title}: done and dusted.`] : [];
  const pool = [...QUIPS[slot], ...named];
  return pool[hash(title.toLowerCase()) % pool.length];
}

/** The one caption under a post: the referee's own when short, else a quip for the task. */
export function postCaption(item: Pick<FeedItem, "caption" | "taskTitle" | "slot">): string {
  const caption = item.caption.trim();
  return caption && wordCount(caption) <= MAX_CAPTION_WORDS ? caption : quipFor(item.taskTitle, item.slot);
}
