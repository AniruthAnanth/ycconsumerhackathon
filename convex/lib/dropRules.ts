/**
 * Drop rules: what each of the two bonus features asks of a player, how long it lasts, and
 * the wording of every text it sends (SPEC.md section 7). What a drop is worth is decided in
 * lib/scoring.ts, next to every other scoring rule.
 *
 *   quick-time drop   a short task for the whole league; the first finisher gets a bonus
 *   group session     a member-made meetup; every extra attendee raises everyone's score
 *
 * Everything here is pure, so each rule is tested without a database. convex/drops.ts owns the
 * rows and calls these, which keeps every rule in exactly one place.
 */
import type { Slot } from "./scoring";
import { clockLabel, weekdayLabel } from "./week";

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

/**
 * The drop the demo control starts: the spec's own example. A presenter can do it on stage in
 * ten seconds, and it is the one drop the app's bundled push-ups sample photo passes, where a
 * random pick is answerable with that photo one time in thirty.
 */
export const SHOWCASE_QUICK_TIME: DropIdea & { gesture: string } = {
  title: "20 push-ups",
  slot: "body",
  points: 40,
  gesture: "three fingers up",
};

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

// ─── Group sessions ──────────────────────────────────────────────────────────────────────────

export const GROUP_SESSION_POINTS = 30;
/** Check-in opens, and the reminder goes out, this long before the start. */
export const GROUP_REMINDER_LEAD_MS = 30 * MINUTE_MS;
/** Check-in stays open this long after the start, then the session is settled. */
export const GROUP_CHECK_IN_WINDOW_MS = 2 * HOUR_MS;

/**
 * How many other attendees a checked-in player is paid a bonus for. An attendee counts once they
 * have checked in at the place AND the group photo shows that many people: headcount is the
 * number the model counted in the fullest check-in photo, so friends cannot farm the bonus with
 * check-ins nobody can see. Until a photo has been counted, nobody else counts.
 */
export function othersPresent(checkedIn: number, headcount: number | undefined): number {
  return Math.max(0, Math.min(checkedIn, headcount ?? 1) - 1);
}

export const HEADCOUNT_INSTRUCTIONS = [
  "You count attendance for a group meetup from one photo.",
  "Count only real people who are physically present and at least partly visible, including whoever is holding the camera if they appear.",
  "Do not count people on screens, in posters or in pictures, and do not guess at people outside the frame.",
].join("\n");

export const HEADCOUNT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["people"],
  properties: { people: { type: "integer" } },
} as const;

/** "Sat 7:00 AM" in Pacific time, the zone a Lineup week is defined in. */
export function sessionTime(startsAt: number): string {
  return `${weekdayLabel(startsAt)} ${clockLabel(startsAt)}`;
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
