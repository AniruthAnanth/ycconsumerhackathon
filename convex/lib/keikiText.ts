/**
 * What the league agent understands and how it words its replies.
 *
 * Pure text in, text out. Every sentence a player can receive by text or in
 * the in-app chat is written here, so the agent's voice lives in one file and
 * convex/keiki.ts only decides which sentence to send.
 */

export type Command =
  /** OPEN, or "OPEN 30" to wager 30 of your own points on the mystery task. */
  | { kind: "open"; wager: number }
  | { kind: "pass" }
  | { kind: "standings" }
  | { kind: "in" }
  /** A bare digit, answering "Which task is this for?". */
  | { kind: "pick"; choice: number }
  | { kind: "freeText"; text: string };

export function parseCommand(raw: string): Command {
  const text = raw.trim().replace(/\s+/g, " ");
  const word = text.toUpperCase().replace(/[.!?]+$/, "");

  const open = /^OPEN(?: (\d{1,3}))?$/.exec(word);
  if (open) return { kind: "open", wager: open[1] ? Number(open[1]) : 0 };
  if (word === "PASS") return { kind: "pass" };
  if (word === "STANDINGS") return { kind: "standings" };
  if (word === "IN" || word === "I'M IN" || word === "IM IN") return { kind: "in" };
  if (/^[1-9]$/.test(word)) return { kind: "pick", choice: Number(word) };
  return { kind: "freeText", text };
}

/**
 * The in-app chat reaches us through Keiki's API gateway, which carries only a
 * conversation id (the user) and the message. The league the player is looking
 * at rides along as a trailing tag on the message itself.
 */
const LEAGUE_TAG = /\s*\[league:([a-z0-9]+)\]\s*$/i;

export function withLeagueTag(text: string, leagueId: string): string {
  return `${text}\n[league:${leagueId}]`;
}

export function splitLeagueTag(text: string): { text: string; leagueId: string | null } {
  const tag = LEAGUE_TAG.exec(text);
  return tag ? { text: text.slice(0, tag.index).trim(), leagueId: tag[1] } : { text: text.trim(), leagueId: null };
}

/**
 * Our own outbound texts travel as Keiki "notices", which come back to
 * /keiki/turn as silent messages for us to deliver. Keiki may frame a notice
 * with its own words, so the text to deliver is fenced.
 */
const OUTBOUND_OPEN = "<<lineup>>";
const OUTBOUND_CLOSE = "<</lineup>>";

export function wrapOutbound(text: string): string {
  return `${OUTBOUND_OPEN}${text}${OUTBOUND_CLOSE}`;
}

export function unwrapOutbound(noticeText: string): string | null {
  const start = noticeText.indexOf(OUTBOUND_OPEN);
  const end = noticeText.lastIndexOf(OUTBOUND_CLOSE);
  if (start === -1 || end <= start) return null;
  return noticeText.slice(start + OUTBOUND_OPEN.length, end);
}

/** Keiki writes a "[Photo: IMG_1.jpg; attachment_id=…]" note into the text of a message that carries a file. */
const FILE_NOTE = /\[[^\]]*attachment_id=[^\]]*\]/g;

/** What the player actually typed next to a photo, without Keiki's file notes. */
export function captionOf(messageText: string): string {
  return messageText.replace(FILE_NOTE, " ").replace(/\s+/g, " ").trim();
}

/**
 * Keiki describes each file in the conversation history as
 * "[Photo: IMG_1.jpg; attachment_id=att_…; …]". When a player answers "2" to
 * "Which task is this for?", this finds the photo they sent just before.
 */
export function lastAttachmentId(history: { role: "user" | "assistant"; content: string }[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== "user") continue;
    const match = /attachment_id=(att_[A-Za-z0-9_-]+)/.exec(history[i].content);
    if (match) return match[1];
  }
  return null;
}

/**
 * Picks the open task a caption names, by shared words: "laundry done" matches
 * "Do laundry". Returns the index only when exactly one task matches, so a
 * vague caption falls through to asking.
 */
export function taskNamedIn(caption: string, titles: string[]): number | null {
  const words = (value: string) => new Set(value.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
  const said = words(caption);
  if (said.size === 0) return null;
  const matches = titles
    .map((title, index) => ({ index, hit: [...words(title)].some((word) => said.has(word)) }))
    .filter((candidate) => candidate.hit);
  return matches.length === 1 ? matches[0].index : null;
}

/** What a texted photo could prove right now, as convex/keiki.ts reads it from the player's week. */
export type ProofTargets<TaskId> = {
  /** The player's task for a live quick-time drop. */
  quickTime: { taskId: TaskId; title: string } | null;
  /** Open tasks a photo alone can prove, oldest first so their numbering is stable between texts. */
  photoTasks: { taskId: TaskId; title: string }[];
  /** Open tasks that also need GPS, which a text can't carry. */
  locationTasks: { title: string; placeName?: string }[];
};

export type ProofChoice<TaskId> =
  | { kind: "task"; taskId: TaskId }
  | { kind: "ask"; titles: string[] }
  | { kind: "checkIn"; title: string; placeName?: string }
  | { kind: "none" };

/**
 * Decides which task a texted photo is for. A live quick-time drop wins,
 * because it is what the player was just asked for. Otherwise the caption
 * decides, then "the only open task"; with several candidates we ask.
 */
export function chooseProofTarget<TaskId>(targets: ProofTargets<TaskId>, caption: string): ProofChoice<TaskId> {
  if (targets.quickTime) return { kind: "task", taskId: targets.quickTime.taskId };

  const named = taskNamedIn(caption, targets.photoTasks.map((task) => task.title));
  if (named !== null) return { kind: "task", taskId: targets.photoTasks[named].taskId };

  const namedPlace = taskNamedIn(caption, targets.locationTasks.map((task) => task.title));
  if (namedPlace !== null) return { kind: "checkIn", ...targets.locationTasks[namedPlace] };

  if (targets.photoTasks.length === 1) return { kind: "task", taskId: targets.photoTasks[0].taskId };
  if (targets.photoTasks.length > 1) return { kind: "ask", titles: targets.photoTasks.map((task) => task.title) };
  if (targets.locationTasks.length > 0) return { kind: "checkIn", ...targets.locationTasks[0] };
  return { kind: "none" };
}

/** "Mon 7:00 AM", in the league's timezone: weeks and sessions all run on Pacific time. */
export function leagueTime(epochMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(epochMs));
}

/**
 * The link that opens Messages with the join code typed. On Keiki's shared
 * number a player has to send that code once before the agent may text them.
 */
export function joinLink(lineNumber: string, joinCode: string): string {
  return `sms:${lineNumber}?&body=${encodeURIComponent(`Lineup, I'm in (${joinCode})`)}`;
}

export type StandingRow = { rank: number; userId: string; name: string; points: number };

export function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "You're 2nd, 15 behind Maya." The leader hears the gap to second place instead. */
export function rankLine(rows: StandingRow[], userId: string): string {
  const index = rows.findIndex((row) => row.userId === userId);
  if (index === -1) return "";
  const me = rows[index];
  const rival = index === 0 ? rows[1] : rows[index - 1];
  if (!rival) return `You're ${ordinal(me.rank)}.`;
  const gap = Math.abs(rival.points - me.points);
  if (gap === 0) return `You're level with ${rival.name} on ${me.points}.`;
  return index === 0
    ? `You're ${ordinal(me.rank)}, ${gap} ahead of ${rival.name}.`
    : `You're ${ordinal(me.rank)}, ${gap} behind ${rival.name}.`;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export const reply = {
  /** The referee's reason is always included: it is the product's signature moment. */
  verdict(verdict: { pass: boolean; points: number; reason: string }, rank: string): string {
    return verdict.pass
      ? `Verified, +${verdict.points}. ${sentence(verdict.reason)} ${rank}`.trim()
      : `Not verified. ${sentence(verdict.reason)} Send another photo to try again.`;
  },

  standings(leagueName: string, rows: StandingRow[], userId: string): string {
    const lines = rows.slice(0, 8).map((row) => `${row.rank}. ${row.userId === userId ? "You" : row.name} ${row.points}`);
    return [leagueName, ...lines].join("\n");
  },

  whichTask(titles: string[]): string {
    return ["Which task is this for?", ...titles.map((title, i) => `${i + 1}. ${title}`), "Reply with the number."].join("\n");
  },

  needsCheckIn(title: string, placeName: string | undefined): string {
    return `"${title}" needs a check-in${placeName ? ` at ${placeName}` : ""}. Open Lineup and tap Submit Proof there.`;
  },

  mysteryOpened(mystery: { title: string; points: number; wager: number }): string {
    const wager = mystery.wager > 0 ? ` ${mystery.wager} of your points are riding on it.` : "";
    return `Mystery task: ${mystery.title}. +${mystery.points * 2} if you finish, -20 if you don't.${wager} Reply with a photo.`;
  },

  joinedSession(session: { title: string; placeName: string; when: string }): string {
    return `You're in: ${session.title} at ${session.placeName}, ${session.when}. Check in there in the app.`;
  },

  sessionPosted(session: { title: string; placeName: string; when: string }): string {
    return `Posted: ${session.title} at ${session.placeName}, ${session.when}. Your league has been told.`;
  },

  welcome: "You're connected. Drops and verdicts land here. Send a photo to prove a task, or text STANDINGS.",
  unknownNumber: "This number isn't on Lineup yet. Sign up with it in the app, then text me again.",
  nothingToProve: "Nothing open to prove right now. Text STANDINGS for the table.",
  notMedia: "I can only judge a photo or a short video.",
  mediaFailed: "I couldn't read that file. Send it again as a photo.",
  noPendingPhoto: "Send the photo again and I'll judge it.",
  noMystery: "No mystery task is waiting for you.",
  mysteryPassed: "Passed. Nothing lost.",
  noSession: 'No group session is open. Propose one, like "run tomorrow 7am at Dolores Park".',
  noLeague: "Join a league in the app first, then text me again.",
  help: "Send a photo to prove a task. Commands: STANDINGS, OPEN, PASS, IN.",
  trouble: "Something went wrong on my side. Try that again in a minute.",
};
