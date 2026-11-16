/**
 * The ways a task can be proven, and what each one asks of the player.
 *
 * The backend (YCCO-5) owns the list; API.md is the contract. The app keeps its own copy of the
 * union here because the capture screens must still open for a type the shared Task type in
 * lib/slots.ts has not caught up with yet.
 */
import type { ProofType } from "@/lib/slots";

export type CaptureProofType = ProofType | "before_after" | "timelapse" | "screenshot";

const KNOWN: readonly CaptureProofType[] = ["photo", "photo_location", "canvas", "before_after", "timelapse", "screenshot"];

/** An unknown or missing type opens the plain camera, which every task can fall back on. */
export function parseProofType(value: string | undefined): CaptureProofType {
  return KNOWN.find((known) => known === value) ?? "photo";
}

/** A task with no target from the draft asks for ten minutes, which suits the short tasks that lack one. */
export const DEFAULT_TARGET_MINUTES = 10;

/** The referee is shown this many stills from a timelapse, spread evenly across it. */
export const TIMELAPSE_FRAMES = 8;

/** Longest a timelapse records before the camera stops it: twice the target, and never past an hour. */
export function timelapseCapSeconds(targetMinutes: number): number {
  return Math.min(60 * 60, targetMinutes * 60 * 2);
}

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

/**
 * The one line telling the player how to prove a task, on the task sheet and over the camera.
 * Every proof is a timelapse (owner's call, Nov 16), so it names the minutes and nothing else.
 */
export function howToProve(task: { targetMinutes?: number }): string {
  return `Record a timelapse while you do it, at least ${task.targetMinutes ?? DEFAULT_TARGET_MINUTES} min.`;
}
