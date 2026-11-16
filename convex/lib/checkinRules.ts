/**
 * Check-in rules: which check-in the app asks for, when the agent may text about it, and the
 * wording of both.
 *
 * Lineup does not wait for a player to remember a task. Roster shows one prompt with one button,
 * and the league's Keiki agent texts when a day or the week is about to slip away, when a rival
 * goes past, or when the player arrives at a task's place. Everything that decides or words those
 * moments is here as pure functions, so each rule is tested without a database.
 * convex/checkins.ts loads the rows and calls these.
 *
 * The voice is a scoreboard's: short, and it names the rival and the gap.
 */
import { distanceMeters, isValidLatLng, type LatLng } from "./geo";
import { CORE_SLOTS, scoreWeek, type Slot } from "./scoring";
import { DAY_MS, HOUR_MS, MINUTE_MS, dayOfWeek, pacificWallClock } from "./week";

/** Indexed by lib/week.ts dayOfWeek: 0 is Monday. */
const WEEKDAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

/**
 * Words that mark a place as somewhere people work out, matched whole and ignoring case against
 * what the phone's reverse geocoder calls where it is ("Fitness SF", "Mission Cliffs Climbing").
 * Short on purpose: a wrong yes interrupts someone, and a wrong no only means they open the
 * camera themselves. Whole-word matching keeps "gym" out of "Gymboree" and "fitness" out of
 * "Fitzgerald".
 */
const GYM_WORDS = [
  "gym",
  "fitness",
  "crossfit",
  "barbell",
  "yoga",
  "pilates",
  "climbing",
  "bouldering",
  "boxing",
  "athletic club",
  "sports club",
  "rec center",
  "recreation center",
  "ymca",
  "equinox",
  "orangetheory",
  "soulcycle",
];
const GYM_PATTERN = new RegExp("\\b(?:" + GYM_WORDS.map((word) => word.replace(" ", "[\\s-]+")).join("|") + ")s?\\b", "i");

export function looksLikeGym(placeName: string): boolean {
  return GYM_PATTERN.test(placeName);
}

const PLACE_NAME_MAX = 60;

/**
 * A geocoder's name as the copy uses it. The name comes from the phone, so it is cut to what
 * fits the prompt's one line and one text before it is ever echoed back.
 */
export function tidyPlaceName(placeName: string | undefined): string | undefined {
  return placeName?.trim().slice(0, PLACE_NAME_MAX).trim() || undefined;
}

/**
 * The place a reported arrival counts for, or null when it does not count. A task with a pin
 * counts only within 30 m of it, and the geocoder's name is ignored: the pin is the player's own
 * word for where the task happens. A Body task with no pin, which is what most drafted workouts
 * are, counts when the phone says it is at a gym, and the text names that place.
 */
export function arrivalPlace(input: {
  task: Pick<CheckInTask<unknown>, "slot" | "place">;
  phone: LatLng;
  placeName?: string;
}): string | null {
  const { task, phone } = input;
  const placeName = tidyPlaceName(input.placeName);
  if (task.place !== undefined) return hasArrived(phone, task.place) ? task.place.name : null;
  if (task.slot !== "body" || placeName === undefined || !isValidLatLng(phone)) return null;
  return looksLikeGym(placeName) ? placeName : null;
}

/** A task as these rules see it: the tasks row plus the moment it can no longer be proven. */
export type CheckInTask<TaskId> = {
  taskId: TaskId;
  slot: Slot;
  title: string;
  points: number;
  status: "open" | "verified" | "held" | "failed";
  proofType: "photo" | "photo_location" | "canvas" | "before_after" | "timelapse" | "screenshot" | "survey_video";
  /** "drop" is the task a quick-time drop gave this player. */
  source: "draft" | "flex" | "drop" | "group";
  place?: LatLng & { name: string };
  /** The gesture a quick-time drop demands in the photo, which the camera shows over the viewfinder. */
  gesture?: string;
  /** The drop's close for a task that came from a drop, otherwise the end of the week. */
  closesAt: number;
};

type SlotFacts = Pick<CheckInTask<unknown>, "slot" | "status" | "source">;

export type CheckIn<TaskId> =
  | { kind: "drop"; task: CheckInTask<TaskId> }
  | { kind: "nearby"; task: CheckInTask<TaskId>; meters: number; placeName?: string }
  | { kind: "at_risk"; task: CheckInTask<TaskId> };

/**
 * The one check-in to ask for right now, or null when there is nothing to ask.
 *
 *   1. a live quick-time drop: it closes within hours and the whole league is racing for it;
 *   2. a task whose pinned place the player has just arrived at: it will never be easier;
 *   3. at a gym, a Body task with no pin: most drafted workouts pin nothing, so the place name the
 *      phone reports stands in for the pin (a photo or text is still what proves it);
 *   4. the task most at risk: the least time left, and one that clears a slot before one that
 *      only adds points, because the five slots are what the stake rides on.
 *
 * Nothing is asked once the week is settled or over, or when every task is proven.
 */
export function pickCheckIn<TaskId>(input: {
  now: number;
  week: { endsAt: number; settled: boolean };
  tasks: readonly CheckInTask<TaskId>[];
  /** Where the phone is, when the player has allowed location. */
  coords?: LatLng;
  /** What the phone's reverse geocoder calls where it is, e.g. "Fitness SF". */
  placeName?: string;
}): CheckIn<TaskId> | null {
  const { now, week, tasks, coords } = input;
  const placeName = tidyPlaceName(input.placeName);
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
  const clearsASlot = (task: SlotFacts) => slotsClearedBy(task).some((slot) => !proven.has(slot));

  if (placeName !== undefined && looksLikeGym(placeName)) {
    const workout = provable
      .filter((task) => task.slot === "body" && task.place === undefined)
      .sort((a, b) => Number(clearsASlot(b)) - Number(clearsASlot(a)) || b.points - a.points)[0];
    if (workout !== undefined) return { kind: "nearby", task: workout, meters: 0, placeName };
  }

  const atRisk = [...provable].sort(
    (a, b) =>
      a.closesAt - b.closesAt ||
      Number(clearsASlot(b)) - Number(clearsASlot(a)) ||
      b.points - a.points,
  )[0];
  return atRisk === undefined ? null : { kind: "at_risk", task: atRisk };
}

/**
 * The core slots a task clears once it is verified. As in lib/scoring.ts, only the drafted lineup
 * clears a slot, because bonus tasks must never decide the stake; the one exception is a group
 * session, which counts for both Body and People.
 */
function slotsClearedBy(task: SlotFacts): Slot[] {
  if (task.source === "group") return ["body", "people"];
  return task.source === "draft" && task.slot !== "flex" ? [task.slot] : [];
}

/**
 * Slots that need no more proof from the player this week. A held task counts: its proof is in
 * and only a league vote can change it, so there is nothing to ask the player for.
 */
export function provenSlots(tasks: readonly SlotFacts[]): Set<Slot> {
  const proven = new Set<Slot>();
  for (const task of tasks) {
    if (task.status !== "verified" && task.status !== "held") continue;
    for (const slot of slotsClearedBy(task)) proven.add(slot);
  }
  return proven;
}

/** How many of the five core slots are cleared: the "1 of 5" in a pace text. */
export function clearedCount(tasks: readonly SlotFacts[]): number {
  const proven = provenSlots(tasks);
  return CORE_SLOTS.filter((slot) => proven.has(slot)).length;
}

/** The core slots with an open task and no proof yet, in roster order: what the stake rides on. */
export function slotsAtStake(tasks: readonly SlotFacts[]): Slot[] {
  const proven = provenSlots(tasks);
  const open = new Set(tasks.filter((task) => task.status === "open").flatMap(slotsClearedBy));
  return CORE_SLOTS.filter((slot) => open.has(slot) && !proven.has(slot));
}

/**
 * What proving the task would add to the player's points in the standings: its own points plus
 * the slot, sweep and streak bonuses the proof would earn. It is the League tab's own scoreWeek,
 * run on the week as it stands and as it would be, so "flips it" is never a guess.
 *
 * proofDays are the Pacific days (lib/week.ts pacificDay) on which the player already has a
 * verified proof; today is the day the new proof would land on.
 */
export function pointsIfProven<TaskId>(
  task: CheckInTask<TaskId>,
  tasks: readonly CheckInTask<TaskId>[],
  proofDays: readonly number[],
  today: number,
): number {
  const proven = tasks.map((other) => (other.taskId === task.taskId ? { ...other, status: "verified" as const } : other));
  return scoreWeek(proven, [...proofDays, today]).total - scoreWeek(tasks, proofDays).total;
}

// ─── The rival ───────────────────────────────────────────────────────────────────────────────

/** gap is the rival's points minus the player's: positive when the rival leads. */
export type Rival<UserId> = { userId: UserId; name: string; gap: number };

type RivalGap = Pick<Rival<unknown>, "name" | "gap">;

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
 * Members the prover has just gone past: level with or ahead of where the prover stood before the
 * proof, and behind where the prover stands now. gap is how far ahead the prover is now. A member
 * with nothing on the board has not been passed by anyone; without that, the first proof of a
 * week would text the whole league.
 */
export function passedBy<UserId>(input: {
  prover: { before: number; after: number };
  others: readonly { userId: UserId; points: number }[];
}): { userId: UserId; gap: number }[] {
  const { prover } = input;
  return input.others
    .filter((other) => other.points > 0 && other.points >= prover.before && other.points < prover.after)
    .map((other) => ({ userId: other.userId, gap: prover.after - other.points }));
}

/**
 * Members a proof leaves behind: everyone the prover went past, and the prover's head-to-head
 * opponent whenever the proof leaves the opponent trailing, because in a matchup every point the
 * other side scores is ground lost. gap is how far ahead the prover is now.
 */
export function leftBehind<UserId>(input: {
  prover: { before: number; after: number };
  others: readonly { userId: UserId; points: number }[];
  /** The prover's matchup opponent this week, when there is one. */
  opponent?: UserId;
}): { userId: UserId; gap: number }[] {
  const passed = passedBy(input);
  const opponent = input.others.find((other) => other.userId === input.opponent);
  if (opponent === undefined || opponent.points >= input.prover.after) return passed;
  if (passed.some((member) => member.userId === opponent.userId)) return passed;
  return [...passed, { userId: opponent.userId, gap: input.prover.after - opponent.points }];
}

/**
 * Whether the proof put the prover in front of the whole league when they were not before. The
 * league is texted when its lead changes hands (convex/leadChange.ts), and that text reaches
 * everyone the new leader went past on the way, so no "just passed you" goes out as well: one
 * text per event.
 */
export function tookTheLead(input: {
  prover: { before: number; after: number };
  others: readonly { points: number }[];
}): boolean {
  const { prover, others } = input;
  return others.every((other) => other.points < prover.after) && others.some((other) => other.points >= prover.before);
}

// ─── Wording ─────────────────────────────────────────────────────────────────────────────────

/** "Maya's up 15." A first name is how league mates talk, and it keeps the prompt on one line. */
export function rivalLine(rival: RivalGap): string {
  const name = firstName(rival.name);
  if (rival.gap > 0) return `${name}'s up ${rival.gap}.`;
  if (rival.gap < 0) return `${name}'s ${-rival.gap} back.`;
  return `Tied with ${name}.`;
}

/** What proving the task does to the gap: "Leg day flips it." worth comes from pointsIfProven. */
function swingLine(title: string, worth: number, gap: number): string {
  if (gap === 0) return `${title} breaks it.`;
  if (gap < 0) return `${title} makes it ${worth - gap}.`;
  if (worth > gap) return `${title} flips it.`;
  if (worth === gap) return `${title} ties it.`;
  return `${title} cuts it to ${gap - worth}.`;
}

/**
 * The characters that fit on the prompt's one line, beside its tag and its button, on a 393 pt
 * phone. The row cuts off anything longer, and what it cut was the number that made the line
 * worth reading ("Read two papers cut…"). So each line is written fullest first and the first
 * version that fits is used. The last version ends with the task's title or the place: if even
 * that is too long, the part cut off is the one a reader can finish for themselves.
 */
const LINE_FITS = 34;

function firstThatFits(...lines: string[]): string {
  return lines.find((line) => line.length <= LINE_FITS) ?? lines[lines.length - 1];
}

/**
 * The Roster prompt: a ticker tag and one sentence. The rival comes before the task wherever both
 * appear, so when a long title is cut off at the edge of the screen the gap is still readable.
 *
 * A "+40" is the task's own points, the number on its roster row. worth (pointsIfProven) includes
 * the bonuses the proof would earn, and is only used to say what the proof does to the gap.
 */
export function promptCopy(
  checkIn: CheckIn<unknown>,
  context: { now: number; rival: RivalGap | null; worth: number },
): { label: string; line: string } {
  const { task } = checkIn;
  const { now, rival, worth } = context;
  const left = shortDuration(task.closesAt - now);
  const value = `${task.title}, +${task.points}.`;
  switch (checkIn.kind) {
    case "drop":
      return { label: `LIVE ${left}`, line: rival ? `${value} ${rivalLine(rival)}` : value };
    case "nearby": {
      // Arriving is the whole message, so this one line leaves the rival out.
      const here = `You're at ${checkIn.placeName ?? task.place?.name ?? "the spot"}.`;
      return { label: "HERE", line: firstThatFits(`${here} Check in?`, here) };
    }
    case "at_risk":
      return {
        label: `${left} LEFT`,
        line: rival
          ? firstThatFits(
              `${rivalLine(rival)} ${swingLine(task.title, worth, rival.gap)}`,
              `${rivalLine(rival)} ${task.title}.`,
            )
          : firstThatFits(`${task.title} is open. +${task.points}.`, `+${task.points} for ${task.title}.`),
      };
  }
}

/** Evening, nothing proven today: "Leg day isn't on the board yet. Maya's up 15. Reply with a photo." */
export function eveningText(task: Pick<CheckInTask<unknown>, "title" | "proofType">, rival: RivalGap | null): string {
  const gap = rival ? ` ${rivalLine(rival)}` : "";
  return `${task.title} isn't on the board yet.${gap} ${howToProve(task.proofType)}`;
}

/** The morning of the last day: "Last day. Body and Chores still open, $20 on the line." */
export function lastDayText(input: { slots: readonly Slot[]; stakeUsd: number }): string {
  return `Last day. ${listOf(input.slots.map((slot) => SLOT_LABEL[slot]))} still open${onTheLine(input.stakeUsd)}.`;
}

/**
 * The last call, about two hours before the week ends: "It's Sunday, two hours to get Leg day in,
 * $20 on the line. Reply with a photo." It names one task, the one most at risk, because a text
 * that lists five things to do in two hours gets none of them done.
 */
export function finalHoursText(input: {
  now: number;
  weekEndsAt: number;
  task: Pick<CheckInTask<unknown>, "title" | "proofType">;
  stakeUsd: number;
}): string {
  const { now, weekEndsAt, task } = input;
  const left = hoursLeft(weekEndsAt - now);
  return `It's ${WEEKDAY[dayOfWeek(now)]}, ${left} to get ${task.title} in${onTheLine(input.stakeUsd)}. ${howToProve(task.proofType)}`;
}

/** Midweek, behind the pace: "Wednesday and 1 of 5 cleared. Leg day tonight?" */
export function paceText(input: { now: number; cleared: number; task: Pick<CheckInTask<unknown>, "title"> }): string {
  return `${WEEKDAY[dayOfWeek(input.now)]} and ${input.cleared} of ${CORE_SLOTS.length} cleared. ${input.task.title} tonight?`;
}

/** A rival pulled away: "You're falling behind: Maya is up 40 on you this week. Leg day flips it." */
export function behindText(input: {
  rivalName: string;
  gap: number;
  /** The player's way back, with what proving it is worth (pointsIfProven), when they have one. */
  wayBack: (Pick<CheckInTask<unknown>, "title"> & { worth: number }) | null;
}): string {
  const { gap, wayBack } = input;
  const behind = `You're falling behind: ${firstName(input.rivalName)} is up ${gap} on you this week.`;
  return wayBack === null ? behind : `${behind} ${swingLine(wayBack.title, wayBack.worth, gap)}`;
}

/** ", $20 on the line" when money rides on the week, and nothing when it is a free league. */
function onTheLine(stakeUsd: number): string {
  return stakeUsd > 0 ? `, ${dollars(stakeUsd)} on the line` : "";
}

/** "two hours", the way a person says it. Rounded down, so the text never promises time that is gone. */
function hoursLeft(ms: number): string {
  const hours = Math.floor(ms / HOUR_MS);
  if (hours < 1) return "under an hour";
  return ["one hour", "two hours", "three hours"][hours - 1] ?? `${hours} hours`;
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

export type NudgeKind = "evening" | "last_day" | "final_hours" | "pace" | "rival_passed" | "arrival";

/** More than this in a day and the agent is a nag the player mutes. */
export const DAILY_TEXT_CAP = 3;
/** The week's last call is the one text the day's others must not crowd out, so it alone may be a fourth. */
const LAST_CALL_CAP = DAILY_TEXT_CAP + 1;
/**
 * The last call goes out with about two hours left. A week ends at midnight Pacific, so that is
 * 9:50 PM, the last moment before quiet hours.
 */
export const LAST_CALL_MS = 2 * HOUR_MS + 10 * MINUTE_MS;
/** A pace text is for Wednesday to Saturday: by Wednesday a slow start is a pattern, and Sunday has the countdowns. */
const PACE_WEEKDAYS = [2, 3, 4, 5];
/** Nobody is texted from 10 PM to 8 AM Pacific. */
const QUIET_FROM_HOUR = 22;
const QUIET_UNTIL_HOUR = 8;
/** Late enough that "nothing today" is a fact, early enough to still get to the gym. */
const EVENING_FROM_HOUR = 18;
/** The last-day text goes out mid-morning so there is a whole day left to act on it. */
const LAST_DAY_FROM_HOUR = 10;

/** The hard limits every text obeys, whatever triggered it. */
export function mayText(pacificHour: number, sentToday: number, lastCall = false): boolean {
  const quiet = pacificHour >= QUIET_FROM_HOUR || pacificHour < QUIET_UNTIL_HOUR;
  return !quiet && sentToday < (lastCall ? LAST_CALL_CAP : DAILY_TEXT_CAP);
}

/**
 * Whether cleared slots trail the days of the week gone by. One slot a day is the pace that
 * clears five with the weekend to spare: one of five on a Wednesday is two behind.
 */
export function behindPace(now: number, cleared: number): boolean {
  const weekday = dayOfWeek(now);
  return PACE_WEEKDAYS.includes(weekday) && cleared < Math.min(weekday + 1, CORE_SLOTS.length);
}

/**
 * The scheduled text a player is due right now, if any. Each kind goes out at most once a day.
 *
 * The week's deadline comes first: the last call with about two hours left, and before it the
 * last-day text in the morning. Otherwise an empty day gets one text in the evening: the pace
 * text midweek when cleared slots trail the days gone, the plain evening text when they do not.
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
  /** From clearedCount. */
  cleared: number;
  /** Whether pickCheckIn found anything to ask for. */
  hasCheckIn: boolean;
}): "final_hours" | "last_day" | "pace" | "evening" | null {
  const { now, pacificHour, weekEndsAt, sentToday } = input;
  if (now >= weekEndsAt) return null;
  const sent = (kind: NudgeKind) => sentToday.includes(kind);
  const atStake = input.slotsAtStake > 0;

  if (weekEndsAt - now <= LAST_CALL_MS && atStake && input.hasCheckIn && !sent("final_hours")) {
    return mayText(pacificHour, sentToday.length, true) ? "final_hours" : null;
  }
  if (!mayText(pacificHour, sentToday.length)) return null;

  const lastDay = weekEndsAt - now <= DAY_MS;
  // Never after the last call: "Last day" two hours from the end would read as old news.
  if (lastDay && pacificHour >= LAST_DAY_FROM_HOUR && atStake && !sent("last_day") && !sent("final_hours")) {
    return "last_day";
  }
  const evening = pacificHour >= EVENING_FROM_HOUR && !input.provedToday && input.hasCheckIn && !sent("final_hours");
  if (evening && !sent("evening") && !sent("pace")) return behindPace(now, input.cleared) ? "pace" : "evening";
  return null;
}

/**
 * Every nudge that has something true to say to a player right now, most pressing first, whatever
 * the hour and whatever went out today. Demo controls' "Send nudge now" walks this list so each
 * kind can be shown on stage without waiting for its moment.
 */
export function relevantNudges(input: {
  now: number;
  weekEndsAt: number;
  slotsAtStake: number;
  cleared: number;
  hasCheckIn: boolean;
  /** How far ahead the rival is, from pickRival; null with no rival. */
  rivalGap: number | null;
}): Exclude<NudgeKind, "arrival">[] {
  const left = input.weekEndsAt - input.now;
  if (left <= 0) return [];
  const lastDay = left <= DAY_MS && input.slotsAtStake > 0;
  const kinds: Exclude<NudgeKind, "arrival">[] = [];
  if (lastDay) kinds.push("last_day");
  if (lastDay && input.hasCheckIn) kinds.push("final_hours");
  if (input.rivalGap !== null && input.rivalGap > 0) kinds.push("rival_passed");
  if (input.hasCheckIn) kinds.push(behindPace(input.now, input.cleared) ? "pace" : "evening");
  // Inside the last two hours the last call is the news.
  return left <= LAST_CALL_MS ? kinds.sort((a, b) => Number(b === "final_hours") - Number(a === "final_hours")) : kinds;
}

/**
 * The wall clock in America/Los_Angeles, the zone a Lineup week is defined in: the calendar day
 * ("2026-11-15", what the daily cap is counted over) and the hour (what quiet hours are measured in).
 */
export function pacificClock(ts: number): { day: string; hour: number } {
  // Shifted by the Pacific offset, the UTC getters read Pacific wall-clock time.
  const wall = pacificWallClock(ts);
  return { day: wall.toISOString().slice(0, 10), hour: wall.getUTCHours() };
}
