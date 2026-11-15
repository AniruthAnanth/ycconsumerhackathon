import { ConvexError } from "convex/values";

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

/** The server's own message when it sent one, since that is what explains a refusal. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return "Something went wrong. Try again.";
}
