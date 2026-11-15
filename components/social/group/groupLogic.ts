import type { Drop } from "@/components/social/contract";
import { GROUP_REMINDER_LEAD_MS } from "@/convex/lib/dropRules";
import { formatClock } from "@/lib/taskText";

export type StartOption = { label: string; startsAt: number };

export type SessionAction =
  | { kind: "join"; label: "I'm In"; disabled: false }
  | { kind: "checkIn"; label: string; disabled: boolean }
  | { kind: "checkedIn"; label: "Checked In"; disabled: true };

const HOUR_MS = 60 * 60 * 1000;
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Offsets are calendar days from today so a DST change cannot shift the hour. */
function atHour(now: Date, dayOffset: number, hour: number): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour).getTime();
}

/** The quick start times a member can pick; tonight's slot is dropped once it has passed. */
export function startTimeOptions(now: number): StartOption[] {
  const today = new Date(now);
  const options: StartOption[] = [
    // Check-in opens 30 minutes before the start, so only "Now" lets a session be checked into straight away.
    { label: "Now", startsAt: now },
    { label: "In 1 hour", startsAt: now + HOUR_MS },
    { label: "Tonight 7 PM", startsAt: atHour(today, 0, 19) },
    { label: "Tomorrow 7 AM", startsAt: atHour(today, 1, 7) },
    { label: "Tomorrow 6 PM", startsAt: atHour(today, 1, 18) },
  ];
  return options.filter((option) => option.startsAt >= now);
}

/** "Sun 7:00 PM" */
export function formatStart(startsAt: number): string {
  return `${WEEKDAYS[new Date(startsAt).getDay()]} ${formatClock(startsAt)}`;
}

export function canStartSession(form: { title: string; placeName: string; startsAt: number | undefined }): boolean {
  return form.title.trim() !== "" && form.placeName.trim() !== "" && form.startsAt !== undefined;
}

/** What the one primary button on a session offers me. */
export function sessionAction(drop: Drop, myUserId: string): SessionAction {
  const me = drop.attendees?.find((attendee) => attendee.userId === myUserId);
  if (!me) return { kind: "join", label: "I'm In", disabled: false };
  if (me.checkedIn) return { kind: "checkedIn", label: "Checked In", disabled: true };
  // The server hands out the task the proof camera needs only once check-in opens, so until then
  // the button says when that is rather than sitting greyed out with no reason.
  if (drop.taskId === undefined) {
    return { kind: "checkIn", label: `Check-in opens ${formatStart(drop.opensAt - GROUP_REMINDER_LEAD_MS)}`, disabled: true };
  }
  return { kind: "checkIn", label: "Check In", disabled: false };
}
