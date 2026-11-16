/**
 * The shape rules of a weekly lineup: which slots it must fill, how many flex
 * tasks it may hold and what a task's points can be.
 *
 * The draft model is asked to follow these rules, and the app is expected to,
 * but the lineup carries money, so they are enforced here in pure code: once
 * on the model's draft (shapeDraft repairs it) and again when the player locks
 * (lineupProblem refuses it).
 */
import { isValidLatLng } from "./geo";
import {
  CORE_SLOTS,
  clampTaskPoints,
  type CoreSlot,
  type Slot,
} from "./scoring";

export const MAX_FLEX_TASKS = 3;
export const MAX_TITLE_LENGTH = 60;

export type Place = { name: string; lat: number; lng: number };

/** A task before it is locked. Matches DraftTask in API.md. */
export type DraftTask = {
  slot: Slot;
  title: string;
  points: number;
  proofType:
    | "photo"
    | "photo_location"
    | "canvas"
    | "before_after"
    | "timelapse"
    | "screenshot";
  place?: Place;
  /** Timelapse only: how many minutes the stills must span. */
  targetMinutes?: number;
};

const SLOT_LABELS: Record<CoreSlot, string> = {
  body: "Body",
  mind: "Mind",
  recharge: "Recharge",
  chores: "Chores",
  people: "People",
};

// Used only when the model leaves a slot empty despite being told not to. Easy
// and cheap on purpose: a player who said nothing about a slot shouldn't be
// handed a hard task they never asked for.
const FALLBACK_TASKS: Record<CoreSlot, DraftTask> = {
  body: {
    slot: "body",
    title: "Take a 20-minute walk",
    points: 10,
    proofType: "photo",
  },
  mind: {
    slot: "mind",
    title: "30 minutes of focused work",
    points: 15,
    proofType: "photo",
  },
  recharge: {
    slot: "recharge",
    title: "Read for 20 minutes",
    points: 10,
    proofType: "photo",
  },
  chores: {
    slot: "chores",
    title: "Tidy your room",
    points: 10,
    proofType: "photo",
  },
  people: {
    slot: "people",
    title: "Call a friend",
    points: 10,
    proofType: "photo",
  },
};

/**
 * Makes one task self-consistent: a trimmed title, points in range, and a
 * place only on a location task. A location task without a usable place
 * becomes a plain photo task, because a check-in with nowhere to check in at
 * could never be verified.
 */
/** The length a task's timelapse runs when it has none. The app assumes the same. */
export const DEFAULT_TARGET_MINUTES = 10;

export function tidyTask(task: DraftTask): DraftTask {
  const minutes = Math.round(task.targetMinutes ?? DEFAULT_TARGET_MINUTES);
  const tidy: DraftTask = {
    slot: task.slot,
    title: task.title.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH),
    points: clampTaskPoints(task.points),
    // Every proof is a timelapse (the owner's call), between 5 minutes and an hour; a task with
    // no length gets the app's default of 10.
    // A Canvas task keeps its type so canvas.ts can still verify it from the grade.
    proofType: task.proofType === "canvas" ? "canvas" : "timelapse",
    targetMinutes: Math.min(
      60,
      Math.max(5, Number.isFinite(minutes) ? minutes : DEFAULT_TARGET_MINUTES),
    ),
  };
  const place = task.place;
  if (!place || place.name.trim() === "" || !isValidLatLng(place)) return tidy;
  return {
    ...tidy,
    place: { name: place.name.trim(), lat: place.lat, lng: place.lng },
  };
}

/**
 * Repairs a model's draft into a lockable lineup: exactly one task per core
 * slot in roster order, then up to three flex tasks. A second task for a slot
 * that is already filled moves to flex, and an empty slot gets an easy default.
 */
export function shapeDraft(drafted: DraftTask[]): DraftTask[] {
  const core = new Map<CoreSlot, DraftTask>();
  const flex: DraftTask[] = [];
  for (const task of drafted.map(tidyTask)) {
    if (task.title === "") continue;
    if (task.slot !== "flex" && !core.has(task.slot)) {
      core.set(task.slot, task);
    } else if (flex.length < MAX_FLEX_TASKS) {
      flex.push({ ...task, slot: "flex" });
    }
  }
  return [
    ...CORE_SLOTS.map((slot) => core.get(slot) ?? tidyTask(FALLBACK_TASKS[slot])),
    ...flex,
  ];
}

/**
 * Why a lineup can't be locked, as a sentence for the player, or null when it
 * can. Expects tasks that have been through tidyTask.
 */
export function lineupProblem(tasks: DraftTask[]): string | null {
  if (tasks.some((task) => task.title === ""))
    return "Every task needs a title.";
  for (const slot of CORE_SLOTS) {
    const count = tasks.filter((task) => task.slot === slot).length;
    if (count === 0)
      return `Add a ${SLOT_LABELS[slot]} task to lock your lineup.`;
    if (count > 1)
      return `Only one ${SLOT_LABELS[slot]} task fits the lineup. Move the other to Flex.`;
  }
  if (tasks.filter((task) => task.slot === "flex").length > MAX_FLEX_TASKS) {
    return `A lineup holds at most ${MAX_FLEX_TASKS} flex tasks.`;
  }
  return null;
}
