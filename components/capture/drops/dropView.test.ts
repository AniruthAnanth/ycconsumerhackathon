import { describe, expect, it } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";
import type { Drop } from "@/lib/backend";

import { dropView } from "./dropView";

const NOW = 1_000_000;

function drop(overrides: Partial<Drop>): Drop {
  return {
    dropId: "drop1" as Id<"drops">,
    kind: "quicktime",
    title: "Hold a plank",
    slot: "body",
    points: 15,
    opensAt: NOW - 60_000,
    closesAt: NOW + 90_000,
    taskId: "task1" as Id<"tasks">,
    ...overrides,
  };
}

describe("dropView", () => {
  it("hides a drop once its window has closed", () => {
    expect(dropView(drop({ closesAt: NOW }), NOW)).toEqual({ type: "hidden" });
    expect(dropView(drop({ kind: "group", closesAt: NOW - 1 }), NOW)).toEqual({ type: "hidden" });
  });

  it("hides a drop the moment its clock runs out, so no negative time or Submit is shown", () => {
    const quick = drop({ closesAt: NOW + 500 });
    expect(dropView(quick, NOW)).toMatchObject({ type: "timed", countdown: "0:01" });
    expect(dropView(quick, NOW + 500)).toEqual({ type: "hidden" });
    expect(dropView(quick, NOW + 60_000)).toEqual({ type: "hidden" });
  });

  it("builds a timed view with a photo proof for a quick-time drop", () => {
    expect(dropView(drop({ gesture: "three fingers up" }), NOW)).toEqual({
      type: "timed",
      countdown: "1:30",
      points: 15,
      gesture: "three fingers up",
      proof: {
        taskId: "task1",
        title: "Hold a plank",
        points: 15,
        proofType: "photo",
        place: undefined,
        gesture: "three fingers up",
        slot: "body",
      },
    });
  });

  it("asks for location proof when the drop has a place", () => {
    const place = { name: "Gym", lat: 37.77, lng: -122.41 };
    const view = dropView(drop({ place }), NOW);
    expect(view).toMatchObject({ type: "timed", proof: { proofType: "photo_location", place } });
  });

  it("offers no submit when the drop has no task yet", () => {
    expect(dropView(drop({ taskId: undefined }), NOW)).toMatchObject({ type: "timed", proof: undefined });
  });

  it("shows nothing for a drop of a kind the app no longer has", () => {
    expect(dropView(drop({ kind: "mystery" }), NOW)).toEqual({ type: "hidden" });
  });

  it("counts a group session down to its start, then to its end", () => {
    const attendees = [
      { userId: "u1" as Id<"users">, name: "Ana", checkedIn: true },
      { userId: "u2" as Id<"users">, name: "Ben", checkedIn: false },
      { userId: "u3" as Id<"users">, name: "Cy", checkedIn: false },
    ];
    const upcoming = drop({ kind: "group", opensAt: NOW + 30_000, closesAt: NOW + 600_000, attendees, taskId: undefined });
    expect(dropView(upcoming, NOW)).toEqual({
      type: "group",
      dropId: "drop1",
      countdown: "0:30",
      started: false,
      attending: 3,
      going: true,
    });
    expect(dropView(upcoming, NOW + 30_000)).toEqual({
      type: "group",
      dropId: "drop1",
      countdown: "9:30",
      started: true,
      attending: 1,
      going: true,
    });
  });

  it("counts down to the end once check-in opens, before the start time", () => {
    const checkInOpen = drop({ kind: "group", opensAt: NOW + 30_000, closesAt: NOW + 600_000 });
    expect(dropView(checkInOpen, NOW)).toMatchObject({ type: "group", started: true, countdown: "10:00" });
  });

  it("knows whether I have RSVP'd, and assumes I have until my id loads", () => {
    const attendees = [{ userId: "u1" as Id<"users">, name: "Ana", checkedIn: false }];
    const session = drop({ kind: "group", attendees });
    expect(dropView(session, NOW, "u1" as Id<"users">)).toMatchObject({ going: true });
    expect(dropView(session, NOW, "u2" as Id<"users">)).toMatchObject({ going: false });
    expect(dropView(session, NOW)).toMatchObject({ going: true });
  });

  it("treats a group session with no attendees as empty", () => {
    expect(dropView(drop({ kind: "group" }), NOW)).toMatchObject({ type: "group", attending: 0 });
  });
});
