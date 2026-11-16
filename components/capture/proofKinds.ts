/**
 * The ways a task can be proven, and what each one asks of the player.
 *
 * The backend (YCCO-5) owns the list; API.md is the contract. The app keeps its own copy of the
 * union here because the capture screens must still open for a type the shared Task type in
 * lib/slots.ts has not caught up with yet.
 */
import type { ProofType } from "@/lib/slots";

export type CaptureProofType = ProofType | "before_after" | "timelapse" | "screenshot" | "survey_video";

const KNOWN: readonly CaptureProofType[] = ["photo", "photo_location", "canvas", "before_after", "timelapse", "screenshot", "survey_video"];

/** An unknown or missing type opens the plain camera, which every task can fall back on. */
export function parseProofType(value: string | undefined): CaptureProofType {
  return KNOWN.find((known) => known === value) ?? "photo";
}

/** A timelapse with no target from the draft asks for five minutes (the backend's default too). */
export const DEFAULT_TARGET_MINUTES = 5;

/** A timelapse never asks for more than ten minutes: longer is a chore to film, not a better proof. */
export const MAX_TARGET_MINUTES = 10;

/** The minutes a timelapse asks for, from the task's target. */
export function targetMinutesFor(targetMinutes: number | undefined): number {
  return Math.min(MAX_TARGET_MINUTES, Math.max(1, Math.round(targetMinutes ?? DEFAULT_TARGET_MINUTES)));
}

/** The referee is shown this many stills from a timelapse, spread evenly across it. */
export const TIMELAPSE_FRAMES = 8;

/** Longest a timelapse records before the camera stops it: twice the target, and never past an hour. */
export function timelapseCapSeconds(targetMinutes: number): number {
  return Math.min(60 * 60, targetMinutes * 60 * 2);
}

/** A survey video: five seconds panning over the result, sampled into this many stills. */
export const SURVEY_SECONDS = 5;
export const SURVEY_FRAMES = 5;

/** In the interval fallback, one photo every this many milliseconds lands eight across the target. */
export function intervalMs(targetMinutes: number): number {
  return Math.max(5_000, Math.round((targetMinutes * 60_000) / TIMELAPSE_FRAMES));
}

/** Where to sample a recorded clip: the middle of each of eight equal stretches. */
export function frameTimesMs(durationMs: number, count: number = TIMELAPSE_FRAMES): number[] {
  return Array.from({ length: count }, (_, i) => Math.round(((i + 0.5) / count) * durationMs));
}

/** Up to `count` items, spread evenly from the first to the last, always keeping both ends. */
export function pickEvenly<T>(items: T[], count: number = TIMELAPSE_FRAMES): T[] {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, i) => items[Math.round((i * (items.length - 1)) / (count - 1))]);
}

/** "12:05", or "1:02:05" past an hour. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** The one line telling the player how to prove a task, on the task sheet and over the camera. Each task opens the capture its type names. */
export function howToProve(task: { proofType?: CaptureProofType; targetMinutes?: number; place?: { name: string } }): string {
  switch (task.proofType ?? "photo") {
    case "photo_location":
      return task.place ? `Check in at ${task.place.name}.` : "Check in where it happens.";
    case "timelapse":
      return `Record a ${targetMinutesFor(task.targetMinutes)}-min timelapse while you do it.`;
    case "before_after":
      return "Snap a before photo, then an after from the same spot.";
    case "screenshot":
      return "Pick a screenshot that shows it's done.";
    case "canvas":
      return "Submit it on Canvas. The referee checks the submission.";
    case "survey_video":
      return "Take a 5-second video showing it's done.";
    default:
      return "Snap a photo that shows it's done.";
  }
}
