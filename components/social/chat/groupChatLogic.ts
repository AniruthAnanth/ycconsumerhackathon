import type { ChatPost } from "@/components/social/contract";

/** Consecutive posts by one author this close together read as one burst: one name, one timestamp. */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export const REACTION_EMOJI = ["👍", "❤️", "😂", "🔥", "💪", "👏"] as const;

export type ChatRow =
  | { kind: "day"; key: string; label: string }
  | { kind: "post"; key: string; post: ChatPost; first: boolean; last: boolean };

/** Sunny has no user id, so it gets a fixed key; members key by their id. */
export function authorKey(post: ChatPost): string {
  return post.author.kind === "sunny" ? "sunny" : post.author.userId;
}

export function authorName(post: ChatPost): string {
  return post.author.kind === "sunny" ? "Sunny" : post.author.name;
}

function sameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function continues(prev: ChatPost | undefined, next: ChatPost): boolean {
  return !!prev && authorKey(prev) === authorKey(next) && next.createdAt - prev.createdAt <= GROUP_WINDOW_MS && sameDay(prev.createdAt, next.createdAt);
}

/** Flattens the thread (oldest first) into day separators and posts marked with where their burst starts and ends. */
export function buildRows(posts: ChatPost[], now: number): ChatRow[] {
  const rows: ChatRow[] = [];
  posts.forEach((post, i) => {
    const prev = posts[i - 1];
    if (!prev || !sameDay(prev.createdAt, post.createdAt)) {
      rows.push({ kind: "day", key: `day-${post.createdAt}`, label: dayLabel(post.createdAt, now) });
    }
    rows.push({ kind: "post", key: post._id, post, first: !continues(prev, post), last: !continues(post, posts[i + 1] ?? post) || i === posts.length - 1 });
  });
  return rows;
}

/** "4:52 PM". */
export function formatTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Today", "Yesterday", or "Mon, Nov 10". */
export function dayLabel(ms: number, now: number): string {
  if (sameDay(ms, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(ms, yesterday.getTime())) return "Yesterday";
  const d = new Date(ms);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** The one-line quote of a reply target: its first line, cut short. */
export function snippet(text: string, max = 80): string {
  const line = text.split("\n")[0]!.trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
