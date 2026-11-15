import { describe, expect, it } from "vitest";

import { liveToastText, newLeagueEvents, type LiveFeedItem } from "./liveEvents";

const item = (proofId: string, userId: string, points = 40, taskTitle = "Leg day", name = "Sam Lee"): LiveFeedItem => ({
  proofId,
  user: { _id: userId, name },
  taskTitle,
  points,
});

describe("newLeagueEvents", () => {
  it("finds nothing on first load", () => {
    expect(newLeagueEvents(undefined, [item("p1", "sam")], "me")).toEqual([]);
  });

  it("finds nothing while the query reloads or the viewer is unknown", () => {
    expect(newLeagueEvents([item("p1", "sam")], undefined, "me")).toEqual([]);
    expect(newLeagueEvents([], [item("p1", "sam")], undefined)).toEqual([]);
  });

  it("returns items that were not in the previous result", () => {
    const before = [item("p1", "sam")];
    const after = [item("p2", "kai"), item("p1", "sam")];
    expect(newLeagueEvents(before, after, "me").map((i) => i.proofId)).toEqual(["p2"]);
  });

  it("skips the viewer's own proofs", () => {
    const after = [item("p2", "me"), item("p1", "sam")];
    expect(newLeagueEvents([], after, "me").map((i) => i.proofId)).toEqual(["p1"]);
  });

  it("orders several arrivals oldest first", () => {
    const after = [item("p3", "kai"), item("p2", "sam"), item("p1", "sam")];
    expect(newLeagueEvents([item("p1", "sam")], after, "me").map((i) => i.proofId)).toEqual(["p2", "p3"]);
  });

  it("ignores an item that changed but was already there, such as a new reaction", () => {
    expect(newLeagueEvents([item("p1", "sam", 40)], [item("p1", "sam", 40)], "me")).toEqual([]);
  });
});

describe("liveToastText", () => {
  it("uses the first name and drops .0 from whole points", () => {
    expect(liveToastText(item("p1", "sam", 40, "Leg day", "Sam Lee"))).toBe("Sam +40 · Leg day");
  });

  it("keeps one decimal for fractional points", () => {
    expect(liveToastText(item("p1", "sam", 12.5, "Read", "Kai"))).toBe("Kai +12.5 · Read");
  });
});
