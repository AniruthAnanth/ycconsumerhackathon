import { describe, expect, it } from "vitest";

import { formatClock, formatScore, taskPlaceLine, taskRowLabel, taskStatusLine, type TaskRowData } from "./taskText";

const base: TaskRowData = { slot: "body", title: "Leg day", points: 40, proofType: "photo_location" };

describe("formatScore", () => {
  it("shows one decimal once scored", () => {
    expect(formatScore(40)).toBe("40");
    expect(formatScore(0)).toBe("0");
    expect(formatScore(12.25)).toBe("12.3");
  });

  it("shows a dash until scored", () => {
    expect(formatScore(null)).toBe("--");
    expect(formatScore(undefined)).toBe("--");
  });
});

describe("formatClock", () => {
  it("formats afternoon, midnight and noon on a 12-hour clock", () => {
    expect(formatClock(new Date(2026, 10, 15, 14, 14).getTime())).toBe("2:14 PM");
    expect(formatClock(new Date(2026, 10, 15, 0, 5).getTime())).toBe("12:05 AM");
    expect(formatClock(new Date(2026, 10, 15, 12, 0).getTime())).toBe("12:00 PM");
  });
});

describe("taskStatusLine", () => {
  it("shows the proof type alone for a draft task", () => {
    expect(taskStatusLine(base)).toBe("Photo + location");
  });

  it("adds the due label to an open task", () => {
    expect(taskStatusLine({ ...base, status: "open", dueLabel: "Due Sun" })).toBe("Photo + location | Due Sun");
  });

  it("shows when a task was verified", () => {
    const verifiedAt = new Date(2026, 10, 15, 14, 14).getTime();
    expect(taskStatusLine({ ...base, status: "verified", verifiedAt })).toBe("Verified 2:14 PM");
  });

  it("closes a drop task nobody proved, with no invitation to retry", () => {
    expect(taskStatusLine({ ...base, proofType: "photo", status: "failed" })).toBe("Missed");
  });

  it("marks a challenged proof", () => {
    expect(taskStatusLine({ ...base, status: "held" })).toBe("Challenged | Points on hold");
  });
});

describe("taskPlaceLine", () => {
  it("names the pinned place", () => {
    expect(taskPlaceLine({ ...base, place: { name: "YC office" } })).toBe("@ YC office");
  });

  it("is empty without a place", () => {
    expect(taskPlaceLine(base)).toBeUndefined();
  });
});

describe("taskRowLabel", () => {
  it("reads out everything the row shows", () => {
    const task = { ...base, status: "open" as const, dueLabel: "Due Sun", place: { name: "YC office" } };
    expect(taskRowLabel(task)).toBe("Leg day, Body, Photo + location, Due Sun, at YC office, 40 points on offer");
  });

  it("says Up next in place of the slot, and the score once there is one", () => {
    expect(taskRowLabel({ ...base, status: "held", score: 40 }, true)).toBe(
      "Leg day, Up next, Challenged, Points on hold, 40 points",
    );
  });
});
