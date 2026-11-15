/**
 * Drop rules: the numbers and the wording behind the three bonus features that sit on top of a
 * week's lineup (SPEC.md section 2 for scoring, section 7 for the texts).
 *
 *   quick-time drop   a short task for the whole league; the first finisher gets a bonus
 *   mystery task      a sealed daily task one player opens (with an optional wager) or passes
 *   group session     a member-made meetup; every extra attendee raises everyone's score
 *
 * Everything here is pure, so each rule is tested without a database. convex/drops.ts owns the
 * rows and calls these to price a task, which keeps every rule in exactly one place.
 */

export type Slot = "body" | "mind" | "recharge" | "chores" | "people" | "flex";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

const SLOT_LABEL: Record<Slot, string> = {
  body: "Body",
  mind: "Mind",
  recharge: "Recharge",
  chores: "Chores",
  people: "People",
  flex: "Flex",
};

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** "2 hours", "30 minutes", "1 hour": the window as a person would say it. */
export function spokenDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE_MS));
  if (minutes % 60 !== 0) return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

// ─── Quick-time drops ────────────────────────────────────────────────────────────────────────

export const QUICK_TIME_WINDOW_MS = 2 * HOUR_MS;
export const FIRST_FINISHER_BONUS = 10;

export type DropIdea = { title: string; slot: Slot; points: number };

/** Doable anywhere within minutes and provable in one frame, because the proof is a texted photo. */
export const QUICK_TIME_IDEAS: readonly DropIdea[] = [
  { title: "20 push-ups", slot: "body", points: 40 },
  { title: "Finish a full glass of water", slot: "recharge", points: 20 },
  { title: "Clear everything off your desk", slot: "chores", points: 30 },
  { title: "One-minute wall sit", slot: "body", points: 35 },
  { title: "Step outside for five minutes", slot: "recharge", points: 25 },
  { title: "Selfie with someone you haven't talked to today", slot: "people", points: 30 },
];

/** The referee must see the gesture in the photo, which is what stops an old photo winning a drop. */
export const GESTURES: readonly string[] = [
  "three fingers up",
  "a thumbs up",
  "a peace sign",
  "one hand on your head",
  "a fist in the air",
];

export function pickQuickTime(random: () => number = Math.random): DropIdea & { gesture: string } {
  return { ...pick(QUICK_TIME_IDEAS, random), gesture: pick(GESTURES, random) };
}

/** The drop's own points, plus +10 for whoever finished first. */
export function quickTimePoints(dropPoints: number, isFirstFinisher: boolean): number {
  return dropPoints + (isFirstFinisher ? FIRST_FINISHER_BONUS : 0);
}

/** Earliest verified proof wins; a tie goes to whoever comes first in the list. */
export function firstFinisher<T extends { verifiedAt: number }>(finishers: readonly T[]): T | undefined {
  return finishers.reduce<T | undefined>(
    (first, next) => (first === undefined || next.verifiedAt < first.verifiedAt ? next : first),
    undefined,
  );
}

export function quickTimeText(drop: { title: string; points: number; gesture: string; windowMs: number }): string {
  return `Quick-time: ${drop.title} in the next ${spokenDuration(drop.windowMs)}, ${drop.gesture} in the photo. +${drop.points}. Reply with a photo.`;
}

// ─── Mystery task ────────────────────────────────────────────────────────────────────────────

/** An envelope lasts from the 8 AM Pacific cron until midnight. */
export const MYSTERY_WINDOW_MS = 16 * HOUR_MS;
/** A mystery pays double, so a base of 15 to 30 is the "30 to 60 points" the morning text promises. */
export const MYSTERY_BASE_POINTS = { min: 15, max: 30 } as const;
export const MYSTERY_FAIL_PENALTY = 20;
export const MAX_WAGER = 50;

/** Used when the model or memory is unavailable, so a morning never passes without an envelope. */
export const MYSTERY_FALLBACKS: readonly DropIdea[] = [
  { title: "Walk 15 minutes without your phone out", slot: "body", points: 20 },
  { title: "Read 20 pages of a real book", slot: "mind", points: 20 },
  { title: "Ten minutes of stretching on the floor", slot: "recharge", points: 15 },
  { title: "Empty every bin in your place", slot: "chores", points: 20 },
  { title: "Coffee or a call with someone you've been meaning to see", slot: "people", points: 25 },
];

export function pickFallbackMystery(random: () => number = Math.random): DropIdea {
  return pick(MYSTERY_FALLBACKS, random);
}

/** What Supermemory is asked for before the model picks: how this player's past weeks went. */
export const MYSTERY_MEMORY_QUERY = "tasks this player completed, skipped or failed in past weeks, by slot";

export const MYSTERY_INSTRUCTIONS = [
  "You set today's mystery task for one player of Lineup, a fantasy league for real life.",
  "Pick ONE task they can finish today in under 30 minutes and prove with a single photo.",
  "Slots: body (fitness), mind (school or work), recharge (destress), chores (life admin), people (connection).",
  "Use their history: choose the slot they have been skipping, and make it easy if they keep failing it.",
  "title: an imperative of at most 8 words. No emoji, nothing unsafe, nothing that costs money.",
  "points: 15 for something trivial up to 30 for real effort.",
].join("\n");

/** Strict schema for the model's answer; parseMystery still checks it, because points are scored. */
export const MYSTERY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "slot", "points"],
  properties: {
    title: { type: "string" },
    slot: { type: "string", enum: ["body", "mind", "recharge", "chores", "people"] },
    points: { type: "integer" },
  },
} as const;

export function mysteryPrompt(memories: readonly string[]): string {
  if (memories.length === 0) return "This player has no history yet. Pick a good all-round task.";
  return `What we remember about this player's past weeks:\n${memories.map((memory) => `- ${memory}`).join("\n")}`;
}

/** The model's answer as a task we can seal, or null when it is not usable. */
export function parseMystery(answer: unknown): DropIdea | null {
  if (typeof answer !== "object" || answer === null) return null;
  const { title, slot, points } = answer as Record<string, unknown>;
  if (typeof title !== "string" || title.trim() === "") return null;
  if (typeof slot !== "string" || !(MYSTERY_SCHEMA.properties.slot.enum as readonly string[]).includes(slot)) return null;
  if (typeof points !== "number") return null;
  return { title: title.trim(), slot: slot as Slot, points: clampMysteryPoints(points) };
}

/** The model proposes the points; this keeps whatever it says inside the advertised range. */
export function clampMysteryPoints(points: number): number {
  if (!Number.isFinite(points)) return MYSTERY_BASE_POINTS.min;
  return clamp(Math.round(points), MYSTERY_BASE_POINTS.min, MYSTERY_BASE_POINTS.max);
}

/** A wager is whole points, at most 50, and never more than the player has to lose. */
export function clampWager(requested: number | undefined, ownPoints: number): number {
  if (requested === undefined || !Number.isFinite(requested)) return 0;
  return clamp(Math.floor(requested), 0, Math.max(0, Math.min(MAX_WAGER, Math.floor(ownPoints))));
}

/** Completed: double points, and the wager comes back doubled, which nets the wager on top. */
export function mysteryWinPoints(basePoints: number, wager: number): number {
  return 2 * basePoints + wager;
}

/** Accepted and not completed: minus 20, and the wager is lost. A passed envelope costs nothing. */
export function mysteryLossPoints(wager: number): number {
  return -(MYSTERY_FAIL_PENALTY + wager);
}

export function mysteryText(slot: Slot): string {
  const range = `${2 * MYSTERY_BASE_POINTS.min} to ${2 * MYSTERY_BASE_POINTS.max}`;
  return `Mystery task: ${SLOT_LABEL[slot]}, ${range} points. Reply OPEN or PASS.`;
}

// ─── Group sessions ──────────────────────────────────────────────────────────────────────────

export const GROUP_SESSION_POINTS = 30;
export const GROUP_BONUS_PER_ATTENDEE = 5;
export const GROUP_BONUS_CAP = 25;
/** Check-in opens, and the reminder goes out, this long before the start. */
export const GROUP_REMINDER_LEAD_MS = 30 * MINUTE_MS;
/** Check-in stays open this long after the start, then the session is settled. */
export const GROUP_CHECK_IN_WINDOW_MS = 2 * HOUR_MS;

/**
 * Base points plus +5 per other attendee, capped at +25. An attendee only counts once they have
 * checked in at the place AND the group photo shows that many people: `headcount` is the number
 * the model counted, so friends cannot farm the bonus with check-ins nobody can see. Until a
 * photo has been counted the session is worth its base points.
 */
export function groupSessionPoints(basePoints: number, checkedIn: number, headcount: number | undefined): number {
  const present = Math.min(checkedIn, headcount ?? 1);
  const others = Math.max(0, present - 1);
  return basePoints + Math.min(GROUP_BONUS_CAP, others * GROUP_BONUS_PER_ATTENDEE);
}

/** "Sat 7:00 AM" in the league's home time zone, which is also the zone a week is defined in. */
export function sessionTime(startsAt: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

export function groupAnnouncementText(s: { creator: string; title: string; placeName: string; startsAt: number }): string {
  return `${s.creator} started a group session: ${s.title} at ${s.placeName}, ${sessionTime(s.startsAt)}. Reply IN to join.`;
}

export function groupReminderText(s: { title: string; placeName: string; startsInMs: number }): string {
  return `${s.title} at ${s.placeName} starts in ${spokenDuration(s.startsInMs)}. Check in there with a group photo.`;
}

export function groupWrapUpText(s: { title: string; checkedIn: number; points: number; photoUrl?: string | null }): string {
  const turnout = s.checkedIn === 1 ? "1 person checked in" : `${s.checkedIn} people checked in`;
  const photo = s.photoUrl ? ` Group photo: ${s.photoUrl}` : "";
  return `${s.title} is done: ${turnout}, +${s.points} each.${photo}`;
}
