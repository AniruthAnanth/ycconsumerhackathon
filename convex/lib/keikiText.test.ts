import { describe, expect, it } from "vitest";
import {
  captionOf,
  chooseProofTarget,
  joinLink,
  lastAttachmentId,
  leagueTime,
  linkCodeIn,
  ordinal,
  parseCommand,
  rankLine,
  reply,
  SCORING_RULES,
  splitLeagueTag,
  taskNamedIn,
  unwrapOutbound,
  weekFacts,
  withoutActionTag,
  withLeagueTag,
  wrapOutbound,
} from "./keikiText";

describe("parseCommand", () => {
  it("reads the text commands whatever the case or punctuation", () => {
    expect(parseCommand("standings")).toEqual({ kind: "standings" });
    expect(parseCommand("I'm in!")).toEqual({ kind: "in" });
    expect(parseCommand("2")).toEqual({ kind: "pick", choice: 2 });
  });

  it("leaves anything else as free text", () => {
    expect(parseCommand("run tomorrow 7am at Dolores Park")).toEqual({
      kind: "freeText",
      text: "run tomorrow 7am at Dolores Park",
    });
    expect(parseCommand("open the pod bay doors")).toEqual({ kind: "freeText", text: "open the pod bay doors" });
    expect(parseCommand("OPEN 30")).toEqual({ kind: "freeText", text: "OPEN 30" });
    expect(parseCommand("pass")).toEqual({ kind: "freeText", text: "pass" });
    expect(parseCommand("in a minute")).toEqual({ kind: "freeText", text: "in a minute" });
  });
});

describe("league tag", () => {
  it("round-trips the league the app chat is about", () => {
    const tagged = withLeagueTag("who is winning?", "jd7abc123");
    expect(splitLeagueTag(tagged)).toEqual({ text: "who is winning?", leagueId: "jd7abc123" });
  });

  it("returns null for a plain text message", () => {
    expect(splitLeagueTag("STANDINGS")).toEqual({ text: "STANDINGS", leagueId: null });
  });
});

describe("outbound fence", () => {
  it("recovers the exact text even when Keiki frames the notice", () => {
    const framed = `[Note from your platform] ${wrapOutbound("Quick-time: 20 push-ups. +40.")} (not from the contact)`;
    expect(unwrapOutbound(framed)).toBe("Quick-time: 20 push-ups. +40.");
  });

  it("returns null for a notice we did not write", () => {
    expect(unwrapOutbound("The video export has finished.")).toBeNull();
  });
});

describe("lastAttachmentId", () => {
  it("finds the most recent file the player sent", () => {
    const history = [
      { role: "user" as const, content: "[Photo: a.jpg; attachment_id=att_OLD1; mime=image/jpeg]" },
      { role: "user" as const, content: "[Photo: b.jpg; attachment_id=att_NEW-2; mime=image/jpeg]" },
      { role: "assistant" as const, content: "Which task is this for?" },
    ];
    expect(lastAttachmentId(history)).toBe("att_NEW-2");
  });

  it("returns null when no file was sent", () => {
    expect(lastAttachmentId([{ role: "user", content: "STANDINGS" }])).toBeNull();
  });
});

describe("taskNamedIn", () => {
  const titles = ["Gym session", "Do laundry", "Read 30 minutes"];

  it("picks the one task the caption names", () => {
    expect(taskNamedIn("laundry done", titles)).toBe(1);
  });

  it("refuses to guess when the caption is vague or names two", () => {
    expect(taskNamedIn("done!", titles)).toBeNull();
    expect(taskNamedIn("laundry then gym session", titles)).toBeNull();
  });
});

describe("captionOf", () => {
  it("drops Keiki's file note and keeps what the player typed", () => {
    expect(captionOf("[Photo: IMG_1.jpg; attachment_id=att_1; mime=image/jpeg] laundry done")).toBe("laundry done");
    expect(captionOf("[Photo: IMG_1.jpg; attachment_id=att_1]")).toBe("");
  });
});

describe("chooseProofTarget", () => {
  const gym = { taskId: "t-gym", title: "Gym session" };
  const laundry = { taskId: "t-laundry", title: "Do laundry" };
  const office = { taskId: "t-office", title: "Work from the YC office", placeName: "YC office", arrived: false };
  const checkInAtOffice = { kind: "checkIn", title: office.title, placeName: office.placeName };
  const nothing = { quickTime: null, photoTasks: [], locationTasks: [] };

  it("gives a live quick-time drop the photo, whatever else is open", () => {
    const targets = { quickTime: { taskId: "t-drop", title: "20 push-ups" }, photoTasks: [gym, laundry], locationTasks: [] };
    expect(chooseProofTarget(targets, "")).toEqual({ kind: "task", taskId: "t-drop" });
  });

  it("uses the only open photo task without asking", () => {
    expect(chooseProofTarget({ ...nothing, photoTasks: [gym] }, "")).toEqual({ kind: "task", taskId: "t-gym" });
  });

  it("lets the caption pick between several, and asks when it can't", () => {
    const targets = { ...nothing, photoTasks: [gym, laundry] };
    expect(chooseProofTarget(targets, "laundry done")).toEqual({ kind: "task", taskId: "t-laundry" });
    expect(chooseProofTarget(targets, "")).toEqual({ kind: "ask", titles: ["Gym session", "Do laundry"] });
  });

  it("sends a location task to the in-app check-in when the phone hasn't been seen there", () => {
    expect(chooseProofTarget({ ...nothing, locationTasks: [office] }, "")).toEqual(checkInAtOffice);
    expect(chooseProofTarget({ ...nothing, photoTasks: [gym, laundry], locationTasks: [office] }, "at the office")).toEqual(
      checkInAtOffice,
    );
  });

  it("accepts a texted photo for a place the player has just arrived at", () => {
    const arrived = { ...office, arrived: true };
    expect(chooseProofTarget({ ...nothing, locationTasks: [arrived] }, "")).toEqual({ kind: "task", taskId: "t-office" });
    // Being there outranks guessing between the photo tasks.
    expect(chooseProofTarget({ ...nothing, photoTasks: [gym, laundry], locationTasks: [arrived] }, "")).toEqual({
      kind: "task",
      taskId: "t-office",
    });
  });

  it("says so when nothing is open", () => {
    expect(chooseProofTarget(nothing, "look")).toEqual({ kind: "none" });
  });
});

describe("leagueTime", () => {
  it("speaks Pacific time whatever the server's zone", () => {
    // 2026-11-16T15:00:00Z is Monday 7:00 AM in Los Angeles.
    expect(leagueTime(Date.UTC(2026, 10, 16, 15, 0))).toBe("Mon 7:00 AM");
  });
});

describe("joinLink", () => {
  it("opens Messages with the join code typed", () => {
    expect(joinLink("+17796251378", "K-ZL2PWU")).toBe("sms:+17796251378?&body=Hi%20Sunny%20(K-ZL2PWU)");
  });

  it("adds the account's link code after the join code", () => {
    expect(joinLink("+17796251378", "K-ZL2PWU", "MI0R2D5K-9F3A07BC")).toBe(
      "sms:+17796251378?&body=Hi%20Sunny%20(K-ZL2PWU%20MI0R2D5K-9F3A07BC)",
    );
  });
});

describe("linkCodeIn", () => {
  it("reads the code and the millisecond it names, however the phone cased it", () => {
    expect(linkCodeIn("Lineup, I'm in (K-ZL2PWU) mi0r2d5k-9f3a07bc")).toEqual({
      code: "MI0R2D5K-9F3A07BC",
      createdMs: parseInt("mi0r2d5k", 36),
    });
  });

  it("reads it from the text the Text Sunny button writes", () => {
    expect(linkCodeIn("Hi Sunny (K-ZL2PWU MI0R2D5K-9F3A07BC)")?.code).toBe("MI0R2D5K-9F3A07BC");
  });

  it("finds none in the join code alone or in an ordinary text", () => {
    expect(linkCodeIn("Lineup, I'm in (K-ZL2PWU)")).toBeNull();
    expect(linkCodeIn("run tomorrow 7am at Dolores Park")).toBeNull();
  });
});

describe("rankLine", () => {
  const rows = [
    { rank: 1, userId: "maya", name: "Maya", points: 240 },
    { rank: 2, userId: "me", name: "Ani", points: 225 },
    { rank: 3, userId: "sam", name: "Sam", points: 180 },
  ];

  it("tells a chaser the gap to the player above", () => {
    expect(rankLine(rows, "me")).toBe("You're 2nd, 15 behind Maya.");
  });

  it("tells the leader the gap to second", () => {
    expect(rankLine(rows, "maya")).toBe("You're 1st, 15 ahead of Ani.");
  });

  it("handles a tie and a league of one", () => {
    expect(rankLine([rows[0], { ...rows[1], points: 240 }], "me")).toBe("You're level with Maya on 240.");
    expect(rankLine([rows[0]], "maya")).toBe("You're 1st.");
  });
});

describe("weekFacts", () => {
  const rows = [
    { rank: 1, userId: "maya", name: "Maya Chen", points: 500, slotsCleared: 4, streak: 3 },
    { rank: 2, userId: "me", name: "Aniruth", points: 225, slotsCleared: 2, streak: 1 },
    { rank: 3, userId: "sam", name: "Sam Patel", points: 195, slotsCleared: 2, streak: 0 },
  ];

  it("names the opponent with both totals, and the player's rank and gap", () => {
    const facts = weekFacts("YC Hackathon", rows, "me", "sam");
    expect(facts).toContain("This week's matchup: the player (225) is playing Sam Patel (195). The player leads by 30.");
    expect(facts).toContain("In the league: You're 2nd, 275 behind Maya Chen.");
    expect(facts).toContain("2. The player: 225 points, 2 slots cleared, 1-day streak");
  });

  it("says so when the player is behind, level or unpaired", () => {
    expect(weekFacts("YC Hackathon", rows, "sam", "me")).toContain("The player trails by 30.");
    expect(weekFacts("YC Hackathon", [rows[1], { ...rows[2], points: 225 }], "me", "sam")).toContain("They are level.");
    expect(weekFacts("YC Hackathon", rows, "me", null)).toContain("The player has no matchup this week.");
  });
});

describe("SCORING_RULES", () => {
  it("states the bonuses with the numbers scoring.ts uses", () => {
    expect(SCORING_RULES).toContain("the higher scorer of a pair gets 50 more; a tie pays nobody");
    expect(SCORING_RULES).toContain("Clearing a slot with its drafted task adds 25, and clearing all 5 adds 100 more");
  });

  it("states the payout rule: an even split among the most slots cleared, kept in escrow", () => {
    expect(SCORING_RULES).toContain("split evenly among the paid members tied for the most slots cleared that week");
    expect(SCORING_RULES).toContain("stay in the league's escrow");
    expect(SCORING_RULES).not.toContain("\u2014");
  });
});

describe("withoutActionTag", () => {
  it("drops a trailing action tag and leaves any other text alone", () => {
    expect(withoutActionTag("Sam is 12 back. Give him a push.\n[action:nudge:Sam Patel]")).toBe("Sam is 12 back. Give him a push.");
    expect(withoutActionTag("You lead by 30.")).toBe("You lead by 30.");
  });
});

describe("ordinal", () => {
  it("covers the teens", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd",
    ]);
  });
});

describe("reply", () => {
  it("words a pass the way the spec shows it, with the referee's reason", () => {
    expect(
      reply.verdict(
        { pass: true, points: 40, reason: "Barbell rack and mirror visible", confidence: 0.9 },
        "You're 2nd, 15 behind Maya.",
      ),
    ).toBe("Verified, +40. Barbell rack and mirror visible. You're 2nd, 15 behind Maya.");
  });

  it("gives a fail its reason and the way to retry", () => {
    expect(reply.verdict({ pass: false, points: 0, reason: "No gesture visible.", confidence: 0.8 }, "")).toBe(
      "Not verified. No gesture visible. Send another photo to try again.",
    );
  });

  it("adds no second instruction to a proof that was turned away unjudged", () => {
    const unjudged = { pass: false, points: 0, confidence: 0, reason: "Videos can't be checked from a text yet. Send a photo instead." };
    expect(reply.verdict(unjudged, "")).toBe("Not verified. Videos can't be checked from a text yet. Send a photo instead.");
  });

  it("lists the table with the player as You", () => {
    expect(
      reply.standings("YC Hackathon", [
        { rank: 1, userId: "maya", name: "Maya", points: 240 },
        { rank: 2, userId: "me", name: "Ani", points: 225 },
      ], "me"),
    ).toBe("YC Hackathon\n1. Maya 240\n2. You 225");
  });
});
