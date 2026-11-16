import type { Task } from "@/lib/backend";
import { formatClock } from "@/lib/taskText";

import { WEEKDAYS } from "../group/groupLogic";

const DEMO_SCHOOL = "demo";
const SCHEME_AND_HOST = /^(?:([a-z][a-z0-9+.-]*):\/\/)?([^/?#]*)/i;

/**
 * What the backend expects for a school: scheme and host only. Students paste
 * whatever is in their browser bar, often a course URL with a path.
 * "demo" selects the built-in demo school and must reach the backend untouched.
 */
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed === DEMO_SCHOOL) return DEMO_SCHOOL;
  const [, scheme = "https", host = ""] = SCHEME_AND_HOST.exec(trimmed) ?? [];
  return host ? `${scheme}://${host}` : "";
}

/** "Due Tue 11:59 PM", in the device's time zone, which is where the student sees the deadline. */
export function dueLabel(dueAt: number | undefined): string {
  if (dueAt === undefined) return "No due date";
  return `Due ${WEEKDAYS[new Date(dueAt).getDay()]} ${formatClock(dueAt)}`;
}

type RosterRow = Pick<Task, "slot" | "title" | "proofType">;

/** A lineup has at most one optional flex task (convex/lib/lineupRules.ts MAX_FLEX_TASKS); convex/canvas.ts addTask refuses a second. */
export const MAX_FLEX_TASKS = 1;

export const flexCount = (rows: readonly RosterRow[]): number => rows.filter((row) => row.slot === "flex").length;

export const isFlexFull = (rows: readonly RosterRow[]): boolean => flexCount(rows) >= MAX_FLEX_TASKS;

/**
 * The server recognises an added assignment by its Canvas ids, which roster rows don't carry, so
 * this compares the title the way addTask stores it (tidyTask: whitespace collapsed, 60 characters).
 */
export function isOnRoster(rows: readonly RosterRow[], title: string): boolean {
  const stored = title.replace(/\s+/g, " ").trim().slice(0, 60);
  return rows.some((row) => row.proofType === "canvas" && row.title === stored);
}
