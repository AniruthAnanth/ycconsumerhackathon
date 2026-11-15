/**
 * Check-in rules: which check-in the app asks for, when the agent may text about it, and the
 * wording of both.
 *
 * Lineup does not wait for a player to remember a task. Roster shows one prompt with one button,
 * and the league's Keiki agent texts when a day or the week is about to slip away, or when a
 * rival goes past. Everything that decides or words those moments is here as pure functions, so
 * each rule is tested without a database. convex/checkins.ts loads the rows and calls these.
 *
 * The voice is a scoreboard's: short, and it names the rival and the gap.
 */

import { distanceMeters, isValidLatLng, type LatLng } from "./geo";

export type Slot = "body" | "mind" | "recharge" | "chores" | "people" | "flex";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** The five slots a player must clear to keep their stake. Flex only adds points. */
const CORE_SLOTS: readonly Slot[] = ["body", "mind", "recharge", "chores", "people"];

const SLOT_LABEL: Record<Slot, string> = {
  body: "Body",
  mind: "Mind",
  recharge: "Recharge",
  chores: "Chores",
  people: "People",
  flex: "Flex",
};

// ─── Which check-in to ask for ───────────────────────────────────────────────────────────────

/**
 * 100 feet: close enough that the player is at the place, not walking past it. Tighter than the
 * referee's 150 m for a location proof, because that forgives GPS drift on a photo already taken
 * and this decides whether to interrupt someone.
 */
export const ARRIVAL_METERS = 30;

/** How long an arrival stands in for GPS on a photo texted from the place. */
export const ARRIVAL_WINDOW_MS = 60 * MINUTE_MS;

export function hasArrived(phone: LatLng, place: LatLng): boolean {
  return isValidLatLng(phone) && distanceMeters(phone, place) <= ARRIVAL_METERS;
}

/** A task as these rules see it: the tasks row plus the moment it can no longer be proven. */
export type CheckInTask<TaskId> = {
  taskId: TaskId;
  slot: Slot;
  title: string;
  points: number;
  status: "open" | "verified" | "held" | "failed";
  proofType: "photo" | "photo_location" | "canvas";
  /** "drop" is the task a quick-time drop gave this player. */
  source: "draft" | "flex" | "drop" | "mystery" | "group";
  place?: LatLng & { name: string };
  /** The drop's close for a task that came from a drop, otherwise the end of the week. */
  closesAt: number;
};

export type CheckIn<TaskId> =
  | { kind: "drop"; task: CheckInTask<TaskId> }
  | { kind: "nearby"; task: CheckInTask<TaskId>; meters: number }
  | { kind: "at_risk"; task: CheckInTask<TaskId> };

/**
 * The one check-in to ask for right now, or null when there is nothing to ask.
 *
 *   1. a live quick-time drop: it closes within hours and the whole league is racing for it;
 *   2. a task whose pinned place the player has just arrived at: it will never be easier;
 *   3. the task most at risk: the least time left, and an uncleared slot before anything else.
 *
 * Nothing is asked once the week is settled or over, or when every task is proven.
 */
export function pickCheckIn<TaskId>(input: {
  now: number;
  week: { endsAt: number; settled: boolean };
  tasks: readonly CheckInTask<TaskId>[];
  /** Where the phone is, when the player has allowed location. */
  coords?: LatLng;
}): CheckIn<TaskId> | null {
  const { now, week, tasks, coords } = input;
  if (week.settled || now >= week.endsAt) return null;

  // The prompt's button opens the proof camera, so only a task the camera can prove qualifies:
  // a Canvas task is verified against Canvas, and held, failed and verified tasks take no proof.
  const provable = tasks.filter(
    (task) => task.status === "open" && task.proofType !== "canvas" && task.closesAt > now,
  );

  const drops = provable.filter((task) => task.source === "drop");
  if (drops.length > 0) {
    return { kind: "drop", task: drops.reduce((a, b) => (b.closesAt < a.closesAt ? b : a)) };
  }

  if (coords !== undefined) {
    const nearest = provable
      .flatMap((task) => (task.place ? [{ task, meters: distanceMeters(coords, task.place) }] : []))
      .filter(({ meters }) => meters <= ARRIVAL_METERS)
      .sort((a, b) => a.meters - b.meters)[0];
    if (nearest !== undefined) return { kind: "nearby", ...nearest };
  }

  const proven = provenSlots(tasks);
  const atRisk = [...provable].sort(
    (a, b) =>
      a.closesAt - b.closesAt ||
      slotUrgency(a.slot, proven) - slotUrgency(b.slot, proven) ||
      b.points - a.points,
  )[0];
  return atRisk === undefined ? null : { kind: "at_risk", task: atRisk };
}

/**
 * Slots that need no more proof this week. A held task counts: its proof is in and only a league
 * vote can change it. A group session is a workout with friends, so it proves Body and People.
 */
export function provenSlots(
  tasks: readonly Pick<CheckInTask<unknown>, "slot" | "status" | "source">[],
): Set<Slot> {
  const proven = new Set<Slot>();
  for (const task of tasks) {
    if (task.status !== "verified" && task.status !== "held") continue;
    proven.add(task.slot);
    if (task.source === "group") proven.add("body").add("people");
  }
  return proven;
}

/** Core slots that still have an open task and no proof, in roster order: what the stake rides on. */
export function slotsAtStake(
  tasks: readonly Pick<CheckInTask<unknown>, "slot" | "status" | "source">[],
): Slot[] {
  const proven = provenSlots(tasks);
  const open = new Set(tasks.filter((task) => task.status === "open").map((task) => task.slot));
  return CORE_SLOTS.filter((slot) => open.has(slot) && !proven.has(slot));
}

/** 0: an uncleared core slot, which decides the stake. 1: flex, extra points. 2: a slot already cleared. */
function slotUrgency(slot: Slot, proven: ReadonlySet<Slot>): number {
  if (slot === "flex") return 1;
  return proven.has(slot) ? 2 : 0;
}

// ─── The rival ───────────────────────────────────────────────────────────────────────────────

/** gap is the rival's points minus the player's: positive when the rival leads. */
export type Rival<UserId> = { userId: UserId; name: string; gap: number };

/**
 * Who the copy names. This week's head-to-head opponent when there is one, because that is the
 * result the player sees on Matchup; otherwise the neighbour in the standings: the player just
 * ahead, or for the leader the player chasing them.
 */
export function pickRival<UserId>(
  me: UserId,
  standings: readonly { userId: UserId; name: string; points: number }[],
  opponent?: UserId,
): Rival<UserId> | null {
  const mine = standings.find((row) => row.userId === me);
  if (mine === undefined) return null;
  const others = standings.filter((row) => row.userId !== me);
  const ahead = others.filter((row) => row.points >= mine.points).sort((a, b) => a.points - b.points);
  const behind = others.filter((row) => row.points < mine.points).sort((a, b) => b.points - a.points);
  const rival = others.find((row) => row.userId === opponent) ?? ahead[0] ?? behind[0];
  if (rival === undefined) return null;
  return { userId: rival.userId, name: rival.name, gap: rival.points - mine.points };
}

/**
 * Members the prover has just gone past: level or ahead the last time anyone looked, behind now.
 * gap is how far ahead the prover is now.
 */
export function passedBy<UserId>(input: {
  prover: { before: number; after: number };
  others: readonly { userId: UserId; before: number; after: number }[];
}): { userId: UserId; gap: number }[] {
  const { prover } = input;
  return input.others
    .filter((other) => other.before >= prover.before && other.after < prover.after)
    .map((other) => ({ userId: other.userId, gap: prover.after - other.after }));
}

// ─── Wording ─────────────────────────────────────────────────────────────────────────────────

/** "Maya's up 15." A first name is how league mates talk, and it keeps the prompt on one line. */
export function rivalLine(rival: Pick<Rival<unknown>, "name" | "gap">): string {
  const name = firstName(rival.name);
  if (rival.gap > 0) return `${name}'s up ${rival.gap}.`;
  if (rival.gap < 0) return `${name}'s ${-rival.gap} back.`;
  return `Tied with ${name}.`;
}

/** What proving the task does to the gap: "Leg day flips it." */
function swingLine(task: { title: string; points: number }, rival: Pick<Rival<unknown>, "gap">): string {
  const { gap } = rival;
  if (gap === 0) return `${task.title} breaks the tie.`;
  if (gap < 0) return `${task.title} makes it ${task.points - gap}.`;
  if (task.points > gap) return `${task.title} flips it.`;
  if (task.points === gap) return `${task.title} ties it.`;
  return `${task.title} cuts it to ${gap - task.points}.`;
}

/**
 * The Roster prompt: a ticker tag and one sentence. The rival comes before the task wherever both
 * appear, so when a long title is cut off at the edge of the screen the gap is still readable.
 */
export function promptCopy(
  checkIn: CheckIn<unknown>,
  now: number,
  rival: Pick<Rival<unknown>, "name" | "gap"> | null,
): { label: string; line: string } {
  const { task } = checkIn;
  const left = shortDuration(task.closesAt - now);
  const worth = `${task.title}, +${task.points}.`;
  switch (checkIn.kind) {
    case "drop":
      return { label: `LIVE ${left}`, line: rival ? `${worth} ${rivalLine(rival)}` : worth };
    case "nearby":
      // Arriving is the whole message, so this one line leaves the rival out.
      return { label: "HERE", line: `You're at ${task.place?.name ?? "the spot"}. Check in?` };
    case "at_risk":
      return {
        label: `${left} LEFT`,
        line: rival ? `${rivalLine(rival)} ${swingLine(task, rival)}` : `${task.title} is open. +${task.points}.`,
      };
  }
}

/** Evening, nothing proven today: "Leg day isn't on the board yet. Maya's up 15. Reply with a photo." */
export function eveningText(
  task: Pick<CheckInTask<unknown>, "title" | "proofType">,
  rival: Pick<Rival<unknown>, "name" | "gap"> | null,
): string {
  const gap = rival ? ` ${rivalLine(rival)}` : "";
  return `${task.title} isn't on the board yet.${gap} ${howToProve(task.proofType)}`;
}

/** Last day: "Last day. Body and Chores are still open. $20 is on the line. Maya's up 15." */
export function lastDayText(input: {
  slots: readonly Slot[];
  stakeUsd: number;
  rival: Pick<Rival<unknown>, "name" | "gap"> | null;
}): string {
  const open = `${listOf(input.slots.map((slot) => SLOT_LABEL[slot]))} ${input.slots.length === 1 ? "is" : "are"} still open.`;
  const stake = input.stakeUsd > 0 ? ` ${dollars(input.stakeUsd)} is on the line.` : "";
  const gap = input.rival ? ` ${rivalLine(input.rival)}` : "";
  return `Last day. ${open}${stake}${gap}`;
}

/** A rival went past: "Maya just passed you in YC Hackathon, up 15. Leg day flips it. Reply with a photo." */
export function passedText(input: {
  rivalName: string;
  gap: number;
  leagueName: string;
  task: Pick<CheckInTask<unknown>, "title" | "points" | "proofType"> | null;
}): string {
  const passed = `${firstName(input.rivalName)} just passed you in ${input.leagueName}, up ${input.gap}.`;
  if (input.task === null) return passed;
  return `${passed} ${swingLine(input.task, input)} ${howToProve(input.task.proofType)}`;
}

/** On arrival, to a player who plays by text: the photo is still required, but a reply is enough. */
export function arrivalText(placeName: string): string {
  return `You're at ${placeName}. Reply with a photo to check in.`;
}

/** A texted photo can't carry GPS and Canvas needs no photo, so those two send the player to the app. */
function howToProve(proofType: CheckInTask<unknown>["proofType"]): string {
  if (proofType === "photo") return "Reply with a photo.";
  if (proofType === "photo_location") return "Check in from the app.";
  return "Verify it in the app.";
}

/** "47M", "9H", "2D": time left the way a ticker shows it. Rounded down, but never "0M". */
export function shortDuration(ms: number): string {
  if (ms < HOUR_MS) return `${Math.max(1, Math.floor(ms / MINUTE_MS))}M`;
  if (ms < 2 * DAY_MS) return `${Math.floor(ms / HOUR_MS)}H`;
  return `${Math.floor(ms / DAY_MS)}D`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Someone";
}

function listOf(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function dollars(usd: number): string {
  return Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;
}

// ─── When the agent may text ─────────────────────────────────────────────────────────────────

export type NudgeKind = "evening" | "last_day" | "rival_passed" | "arrival";

/** More than this in a day and the agent is a nag the player mutes. */
export const DAILY_TEXT_CAP = 3;
/** Nobody is texted from 10 PM to 8 AM Pacific. */
const QUIET_FROM_HOUR = 22;
const QUIET_UNTIL_HOUR = 8;
/** Late enough that "nothing today" is a fact, early enough to still get to the gym. */
const EVENING_FROM_HOUR = 18;
/** The last-day text goes out mid-morning so there is a whole day left to act on it. */
const LAST_DAY_FROM_HOUR = 10;

/** The hard limits every text obeys, whatever triggered it. */
export function mayText(pacificHour: number, sentToday: number): boolean {
  const quiet = pacificHour >= QUIET_FROM_HOUR || pacificHour < QUIET_UNTIL_HOUR;
  return !quiet && sentToday < DAILY_TEXT_CAP;
}

/**
 * The scheduled text a player is due at this hour, if any. Each kind goes out at most once a day.
 * The last-day text wins when both are due; the evening text follows an hour later if the day is
 * still empty.
 */
export function scheduledNudge(input: {
  now: number;
  pacificHour: number;
  weekEndsAt: number;
  /** Kinds already texted to this player today. */
  sentToday: readonly NudgeKind[];
  provedToday: boolean;
  /** From slotsAtStake. */
  slotsAtStake: number;
  /** Whether pickCheckIn found anything to ask for. */
  hasCheckIn: boolean;
}): "last_day" | "evening" | null {
  const { now, pacificHour, weekEndsAt, sentToday } = input;
  if (!mayText(pacificHour, sentToday.length) || now >= weekEndsAt) return null;

  const lastDay = weekEndsAt - now <= DAY_MS;
  if (lastDay && pacificHour >= LAST_DAY_FROM_HOUR && input.slotsAtStake > 0 && !sentToday.includes("last_day")) {
    return "last_day";
  }
  if (pacificHour >= EVENING_FROM_HOUR && !input.provedToday && input.hasCheckIn && !sentToday.includes("evening")) {
    return "evening";
  }
  return null;
}

/**
 * The wall clock in America/Los_Angeles, the zone a Lineup week is defined in: the calendar day
 * (the text cap is per day), the hour (quiet hours) and when that day began (what "today" means
 * for "proven nothing today").
 */
export function pacificClock(ts: number): { day: string; hour: number; startOfDay: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const hour = part("hour") % 24; // some engines print midnight as 24
  const sinceMidnight = ((hour * 60 + part("minute")) * 60 + part("second")) * 1000 + (ts % 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    day: `${part("year")}-${pad(part("month"))}-${pad(part("day"))}`,
    hour,
    // An hour out on the two days a year the clocks change, which only shifts what counts as
    // "today" for the evening text.
    startOfDay: ts - sinceMidnight,
  };
}
