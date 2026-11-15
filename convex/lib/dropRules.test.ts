import { describe, expect, it } from "vitest";
import {
  clampMysteryPoints,
  clampWager,
  firstFinisher,
  GESTURES,
  groupAnnouncementText,
  groupReminderText,
  groupSessionPoints,
  groupWrapUpText,
  mysteryLossPoints,
  mysteryPrompt,
  mysteryText,
  mysteryWinPoints,
  parseMystery,
  pickQuickTime,
  QUICK_TIME_IDEAS,
  QUICK_TIME_WINDOW_MS,
  quickTimePoints,
  quickTimeText,
  spokenDuration,
} from "./dropRules";

describe("quick-time drops", () => {
  it("pays the drop's points, plus 10 to the first finisher only", () => {
    expect(quickTimePoints(40, true)).toBe(50);
    expect(quickTimePoints(40, false)).toBe(40);
  });

  it("names the earliest verified proof as first finisher", () => {
    const finishers = [
      { user: "sam", verifiedAt: 300 },
      { user: "maya", verifiedAt: 100 },
      { user: "leo", verifiedAt: 200 },
    ];
    expect(firstFinisher(finishers)?.user).toBe("maya");
    expect(firstFinisher([])).toBeUndefined();
  });

  it("picks an idea and a gesture from the bank, including at both ends of the random range", () => {
    expect(pickQuickTime(() => 0)).toEqual({ ...QUICK_TIME_IDEAS[0], gesture: GESTURES[0] });
    const last = pickQuickTime(() => 0.9999999);
    expect(last.title).toBe(QUICK_TIME_IDEAS[QUICK_TIME_IDEAS.length - 1].title);
    expect(last.gesture).toBe(GESTURES[GESTURES.length - 1]);
    expect(pickQuickTime(() => 1).gesture).toBe(GESTURES[GESTURES.length - 1]);
  });

  it("writes the text exactly as SPEC.md section 7 has it", () => {
    expect(
      quickTimeText({ title: "20 push-ups", points: 40, gesture: "three fingers up", windowMs: QUICK_TIME_WINDOW_MS }),
    ).toBe("Quick-time: 20 push-ups in the next 2 hours, three fingers up in the photo. +40. Reply with a photo.");
  });

  it("says durations the way a person would", () => {
    expect(spokenDuration(60 * 60 * 1000)).toBe("1 hour");
    expect(spokenDuration(30 * 60 * 1000)).toBe("30 minutes");
    expect(spokenDuration(90 * 60 * 1000)).toBe("90 minutes");
    expect(spokenDuration(10 * 1000)).toBe("1 minute");
  });
});

describe("mystery task", () => {
  it("pays double when completed, and the wager on top", () => {
    expect(mysteryWinPoints(20, 0)).toBe(40);
    expect(mysteryWinPoints(20, 30)).toBe(70);
  });

  it("costs 20 plus the wager when accepted and failed", () => {
    expect(mysteryLossPoints(0)).toBe(-20);
    expect(mysteryLossPoints(30)).toBe(-50);
  });

  it("caps a wager at 50 and at the player's own points", () => {
    expect(clampWager(undefined, 200)).toBe(0);
    expect(clampWager(30, 200)).toBe(30);
    expect(clampWager(80, 200)).toBe(50);
    expect(clampWager(30, 12)).toBe(12);
    expect(clampWager(30, -40)).toBe(0);
    expect(clampWager(-5, 200)).toBe(0);
    expect(clampWager(12.9, 200)).toBe(12);
    expect(clampWager(Number.NaN, 200)).toBe(0);
  });

  it("keeps the model's points inside the advertised 30 to 60 range", () => {
    expect(clampMysteryPoints(5)).toBe(15);
    expect(clampMysteryPoints(22.4)).toBe(22);
    expect(clampMysteryPoints(90)).toBe(30);
    expect(clampMysteryPoints(Number.NaN)).toBe(15);
  });

  it("accepts a usable answer from the model and rejects anything else", () => {
    expect(parseMystery({ title: " Ten-minute jog ", slot: "body", points: 44 })).toEqual({
      title: "Ten-minute jog",
      slot: "body",
      points: 30,
    });
    expect(parseMystery({ title: "", slot: "body", points: 20 })).toBeNull();
    expect(parseMystery({ title: "Anything", slot: "flex", points: 20 })).toBeNull();
    expect(parseMystery({ title: "Anything", slot: "body", points: "20" })).toBeNull();
    expect(parseMystery(null)).toBeNull();
  });

  it("puts the player's memories in front of the model", () => {
    expect(mysteryPrompt(["Skipped Body twice", "Cleared Chores early"])).toBe(
      "What we remember about this player's past weeks:\n- Skipped Body twice\n- Cleared Chores early",
    );
    expect(mysteryPrompt([])).toMatch(/no history yet/);
  });

  it("writes the morning text exactly as SPEC.md section 7 has it", () => {
    expect(mysteryText("body")).toBe("Mystery task: Body, 30 to 60 points. Reply OPEN or PASS.");
  });
});

describe("group sessions", () => {
  it("adds 5 per other attendee once the group photo shows them", () => {
    expect(groupSessionPoints(30, 1, 1)).toBe(30);
    expect(groupSessionPoints(30, 3, 3)).toBe(40);
  });

  it("caps the bonus at 25", () => {
    expect(groupSessionPoints(30, 6, 6)).toBe(55);
    expect(groupSessionPoints(30, 12, 12)).toBe(55);
  });

  it("counts no more attendees than the photo shows, and none before a photo is counted", () => {
    expect(groupSessionPoints(30, 5, 3)).toBe(40);
    expect(groupSessionPoints(30, 2, 9)).toBe(35);
    expect(groupSessionPoints(30, 4, undefined)).toBe(30);
    expect(groupSessionPoints(30, 0, 0)).toBe(30);
  });

  it("writes the announcement, reminder and wrap-up texts", () => {
    // 2026-11-21 15:00 UTC is Saturday 7:00 AM in Los Angeles.
    const startsAt = Date.UTC(2026, 10, 21, 15, 0);
    expect(groupAnnouncementText({ creator: "Maya", title: "Morning run", placeName: "Dolores Park", startsAt })).toBe(
      "Maya started a group session: Morning run at Dolores Park, Sat 7:00 AM. Reply IN to join.",
    );
    expect(groupReminderText({ title: "Morning run", placeName: "Dolores Park", startsInMs: 30 * 60 * 1000 })).toBe(
      "Morning run at Dolores Park starts in 30 minutes. Check in there with a group photo.",
    );
    expect(groupWrapUpText({ title: "Morning run", checkedIn: 4, points: 45, photoUrl: "https://x/p.jpg" })).toBe(
      "Morning run is done: 4 people checked in, +45 each. Group photo: https://x/p.jpg",
    );
    expect(groupWrapUpText({ title: "Morning run", checkedIn: 1, points: 30 })).toBe(
      "Morning run is done: 1 person checked in, +30 each.",
    );
  });
});
