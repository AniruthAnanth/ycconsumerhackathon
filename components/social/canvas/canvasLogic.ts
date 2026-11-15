import type { Task } from "@/lib/backend";

const DEMO_SCHOOL = "demo";
const SCHEME_AND_HOST = /^(?:([a-z][a-z0-9+.-]*):\/\/)?([^/?#]*)/i;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const due = new Date(dueAt);
  const hour = due.getHours() % 12 || 12;
  const minutes = String(due.getMinutes()).padStart(2, "0");
  const meridiem = due.getHours() < 12 ? "AM" : "PM";
  return `Due ${WEEKDAYS[due.getDay()]} ${hour}:${minutes} ${meridiem}`;
}

type RosterRow = Pick<Task, "slot" | "title" | "proofType">;

/** convex/canvas.ts addTask refuses a fourth flex task a week with "You already have 3 flex tasks this week." */
export const MAX_FLEX_TASKS = 3;

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
