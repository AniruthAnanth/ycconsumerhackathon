import type { Drop } from "@/components/social/contract";

export type StartOption = { label: string; startsAt: number };

export type SessionAction =
  | { kind: "join"; label: "I'm In"; disabled: false }
  | { kind: "checkIn"; label: "Check In"; disabled: boolean }
  | { kind: "checkedIn"; label: "Checked In"; disabled: true };

const HOUR_MS = 60 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Offsets are calendar days from today so a DST change cannot shift the hour. */
function atHour(now: Date, dayOffset: number, hour: number): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour).getTime();
}

/** The quick start times a member can pick; tonight's slot is dropped once it has passed. */
export function startTimeOptions(now: number): StartOption[] {
  const today = new Date(now);
  const options: StartOption[] = [
    { label: "In 1 hour", startsAt: now + HOUR_MS },
    { label: "Tonight 7 PM", startsAt: atHour(today, 0, 19) },
    { label: "Tomorrow 7 AM", startsAt: atHour(today, 1, 7) },
    { label: "Tomorrow 6 PM", startsAt: atHour(today, 1, 18) },
  ];
  return options.filter((option) => option.startsAt > now);
}

/** "Sun 7:00 PM" */
export function formatStart(startsAt: number): string {
  const date = new Date(startsAt);
  const hour = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const meridiem = date.getHours() < 12 ? "AM" : "PM";
  return `${WEEKDAYS[date.getDay()]} ${hour}:${minutes} ${meridiem}`;
}

export function canStartSession(form: { title: string; placeName: string; startsAt: number | undefined }): boolean {
  return form.title.trim() !== "" && form.placeName.trim() !== "" && form.startsAt !== undefined;
}

/** What the one primary button on a session offers me. */
export function sessionAction(drop: Drop, myUserId: string): SessionAction {
  const me = drop.attendees?.find((attendee) => attendee.userId === myUserId);
  if (!me) return { kind: "join", label: "I'm In", disabled: false };
  if (me.checkedIn) return { kind: "checkedIn", label: "Checked In", disabled: true };
  // The task arrives with the next query update after joining; the proof camera needs it.
  return { kind: "checkIn", label: "Check In", disabled: drop.taskId === undefined };
}
