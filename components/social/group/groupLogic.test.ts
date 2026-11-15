import { describe, expect, it } from "vitest";

import type { Drop } from "@/components/social/contract";
import { canStartSession, formatStart, sessionAction, startTimeOptions } from "./groupLogic";

// 15 Nov 2026 is a Sunday. Local-time constructors keep the tests independent of the machine's zone.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();

const drop = (overrides: Partial<Drop>): Drop =>
  ({ dropId: "d1", kind: "group", title: "Run", points: 10, attendees: [], ...overrides }) as unknown as Drop;

describe("startTimeOptions", () => {
  it("offers the four quick times from the afternoon", () => {
    const options = startTimeOptions(at(15, 14));
    expect(options.map((option) => option.label)).toEqual([
      "Now",
      "In 1 hour",
      "Tonight 7 PM",
      "Tomorrow 7 AM",
      "Tomorrow 6 PM",
    ]);
    expect(options.map((option) => option.startsAt)).toEqual([at(15, 14), at(15, 15), at(15, 19), at(16, 7), at(16, 18)]);
  });

  it("drops tonight once 7 PM has passed", () => {
    const labels = startTimeOptions(at(15, 20)).map((option) => option.label);
    expect(labels).toEqual(["Now", "In 1 hour", "Tomorrow 7 AM", "Tomorrow 6 PM"]);
  });

  it("rolls tomorrow over a month end", () => {
    const options = startTimeOptions(new Date(2026, 10, 30, 12).getTime());
    expect(options[3].startsAt).toBe(new Date(2026, 11, 1, 7).getTime());
  });
});

describe("formatStart", () => {
  it("formats weekday, 12-hour time and meridiem", () => {
    expect(formatStart(at(15, 19))).toBe("Sun 7:00 PM");
    expect(formatStart(at(16, 7, 5))).toBe("Mon 7:05 AM");
  });

  it("shows noon and midnight as 12", () => {
    expect(formatStart(at(15, 12))).toBe("Sun 12:00 PM");
    expect(formatStart(at(15, 0))).toBe("Sun 12:00 AM");
  });
});

describe("canStartSession", () => {
  it("needs a title, a place name and a time", () => {
    expect(canStartSession({ title: "Run", placeName: "Park", startsAt: 1 })).toBe(true);
    expect(canStartSession({ title: " ", placeName: "Park", startsAt: 1 })).toBe(false);
    expect(canStartSession({ title: "Run", placeName: "", startsAt: 1 })).toBe(false);
    expect(canStartSession({ title: "Run", placeName: "Park", startsAt: undefined })).toBe(false);
  });
});

describe("sessionAction", () => {
  it("offers I'm In to someone who has not joined", () => {
    expect(sessionAction(drop({}), "me")).toEqual({ kind: "join", label: "I'm In", disabled: false });
  });

  it("offers Check In to an attendee who has not checked in", () => {
    const joined = drop({ taskId: "t1" as Drop["taskId"], attendees: [{ userId: "me" as never, name: "Me", checkedIn: false }] });
    expect(sessionAction(joined, "me")).toEqual({ kind: "checkIn", label: "Check In", disabled: false });
  });

  it("holds Check In until the task exists", () => {
    const joined = drop({ attendees: [{ userId: "me" as never, name: "Me", checkedIn: false }] });
    expect(sessionAction(joined, "me").disabled).toBe(true);
  });

  it("shows Checked In, disabled, once checked in", () => {
    const done = drop({ attendees: [{ userId: "me" as never, name: "Me", checkedIn: true }] });
    expect(sessionAction(done, "me")).toEqual({ kind: "checkedIn", label: "Checked In", disabled: true });
  });
});
