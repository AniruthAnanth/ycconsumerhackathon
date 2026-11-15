import { describe, expect, it } from "vitest";
import {
  clampMysteryPoints,
  firstFinisher,
  GESTURES,
  groupAnnouncementText,
  groupReminderText,
  groupWrapUpText,
  mysteryPrompt,
  mysteryText,
  othersPresent,
  parseMystery,
  pickQuickTime,
  QUICK_TIME_IDEAS,
  QUICK_TIME_WINDOW_MS,
  quickTimeText,
  spokenDuration,
} from "./dropRules";

describe("quick-time drops", () => {
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
  it("counts the other attendees who checked in, up to what the group photo shows", () => {
    expect(othersPresent(1, 1)).toBe(0);
    expect(othersPresent(3, 3)).toBe(2);
    expect(othersPresent(5, 3)).toBe(2);
    expect(othersPresent(2, 9)).toBe(1);
  });

  it("counts nobody else until a photo has been counted", () => {
    expect(othersPresent(4, undefined)).toBe(0);
    expect(othersPresent(0, 0)).toBe(0);
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
