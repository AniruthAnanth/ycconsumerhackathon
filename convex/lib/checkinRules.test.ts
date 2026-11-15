import { describe, expect, it } from "vitest";

import {
  type CheckInTask,
  arrivalPlace,
  arrivalText,
  eveningText,
  hasArrived,
  lastDayText,
  looksLikeGym,
  mayText,
  pacificClock,
  passedBy,
  passedText,
  pickCheckIn,
  pickRival,
  pointsIfProven,
  promptCopy,
  provenSlots,
  scheduledNudge,
  shortDuration,
  slotsAtStake,
} from "./checkinRules";

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 15, 20, 0); // Sunday 12:00 PM in Los Angeles
const WEEK = { endsAt: NOW + 12 * HOUR, settled: false };
const YC_OFFICE = { name: "YC office", lat: 37.7577, lng: -122.3882 };

function task(over: Partial<CheckInTask<string>> & { taskId: string }): CheckInTask<string> {
  return {
    slot: "body",
    title: "Leg day",
    points: 40,
    status: "open",
    proofType: "photo",
    source: "draft",
    closesAt: WEEK.endsAt,
    ...over,
  };
}

describe("pickCheckIn", () => {
  const legDay = task({ taskId: "leg" });
  const office = task({ taskId: "office", slot: "mind", title: "Ship the demo", proofType: "photo_location", place: YC_OFFICE });
  const pushUps = task({ taskId: "push", title: "20 push-ups", source: "drop", closesAt: NOW + HOUR });

  it("asks for a live quick-time drop before anything else", () => {
    const pick = pickCheckIn({ now: NOW, week: WEEK, tasks: [legDay, office, pushUps], coords: YC_OFFICE });
    expect(pick).toEqual({ kind: "drop", task: pushUps });
  });

  it("ignores a drop that has closed or that the player already proved", () => {
    const closed = { ...pushUps, closesAt: NOW - 1 };
    const done = { ...pushUps, taskId: "done", status: "verified" as const };
    expect(pickCheckIn({ now: NOW, week: WEEK, tasks: [legDay, closed, done] })?.kind).toBe("at_risk");
  });

  it("asks for the task whose pinned place the player has arrived at (within 100 ft)", () => {
    // 0.0002 degrees of latitude is about 22 m.
    const pick = pickCheckIn({ now: NOW, week: WEEK, tasks: [legDay, office], coords: { lat: 37.7579, lng: -122.3882 } });
    expect(pick?.kind).toBe("nearby");
    expect(pick?.task.taskId).toBe("office");
    expect(pick?.kind === "nearby" && Math.round(pick.meters)).toBe(22);
  });

  it("does not count 100 m away as arriving, even though a proof from there would pass", () => {
    const downTheStreet = { lat: 37.7586, lng: -122.3882 };
    expect(pickCheckIn({ now: NOW, week: WEEK, tasks: [office], coords: downTheStreet })?.kind).toBe("at_risk");
    expect(pickCheckIn({ now: NOW, week: WEEK, tasks: [office] })?.kind).toBe("at_risk");
  });

  it("picks the nearest pin when two are in range", () => {
    const gym = task({ taskId: "gym", place: { name: "Gym", lat: 37.75785, lng: -122.3882 } });
    const pick = pickCheckIn({ now: NOW, week: WEEK, tasks: [office, gym], coords: { lat: 37.7579, lng: -122.3882 } });
    expect(pick?.task.taskId).toBe("gym");
  });

  it("falls back to the task with the least time left", () => {
    const mystery = task({ taskId: "mystery", slot: "recharge", source: "mystery", closesAt: NOW + 2 * HOUR });
    expect(pickCheckIn({ now: NOW, week: WEEK, tasks: [legDay, mystery] })).toEqual({ kind: "at_risk", task: mystery });
  });

  it("with equal time left, puts a task that clears a slot before one that only adds points", () => {
    const flex = task({ taskId: "flex", slot: "flex", source: "flex", points: 50 });
    const bodyDone = task({ taskId: "run", status: "verified" });
    const chores = task({ taskId: "laundry", slot: "chores", points: 10 });
    // A drop task sits in a slot but never clears it, so it ranks with flex.
    const bonusChores = task({ taskId: "desk", slot: "chores", source: "mystery", points: 45 });
    expect(pickCheckIn({ now: NOW, week: WEEK, tasks: [flex, bodyDone, bonusChores, chores] })?.task.taskId).toBe("laundry");
    expect(pickCheckIn({ now: NOW, week: WEEK, tasks: [flex, bodyDone, bonusChores] })?.task.taskId).toBe("flex");
  });

  it("breaks a remaining tie on points", () => {
    const small = task({ taskId: "small", slot: "chores", points: 10 });
    const big = task({ taskId: "big", slot: "mind", points: 45 });
    expect(pickCheckIn({ now: NOW, week: WEEK, tasks: [small, big] })?.task.taskId).toBe("big");
  });

  it("never asks for a Canvas, held, failed or verified task", () => {
    const tasks = [
      task({ taskId: "canvas", proofType: "canvas" }),
      task({ taskId: "held", status: "held" }),
      task({ taskId: "failed", status: "failed" }),
      task({ taskId: "verified", status: "verified" }),
    ];
    expect(pickCheckIn({ now: NOW, week: WEEK, tasks, coords: YC_OFFICE })).toBeNull();
  });

  it("asks for nothing when the week is done", () => {
    expect(pickCheckIn({ now: NOW, week: { ...WEEK, settled: true }, tasks: [legDay, pushUps] })).toBeNull();
    expect(pickCheckIn({ now: WEEK.endsAt, week: WEEK, tasks: [legDay] })).toBeNull();
    expect(pickCheckIn({ now: NOW, week: WEEK, tasks: [] })).toBeNull();
  });
});

describe("looksLikeGym", () => {
  it("matches a gym word in any case, as a whole word", () => {
    for (const name of ["Fitness SF", "24 Hour Fitness", "Mission Cliffs Climbing", "GOLD'S GYM", "Mission Yoga", "SF Boxing Club", "YMCA", "Rec Centers"]) {
      expect(looksLikeGym(name), name).toBe(true);
    }
  });

  it("rejects an address, a word that only starts like a gym word, and nothing", () => {
    for (const name of ["2450 Mission St", "Fitzgerald Hotel", "Gymboree Play & Music", "Blue Bottle Coffee", "24 Hour Diner", ""]) {
      expect(looksLikeGym(name), name).toBe(false);
    }
  });
});

describe("pickCheckIn at a gym", () => {
  const legDay = task({ taskId: "leg" });
  const office = task({ taskId: "office", slot: "mind", title: "Ship the demo", proofType: "photo_location", place: YC_OFFICE });
  const gym = "Fitness SF";

  it("asks for the Body task that pins no place, and names where the phone is", () => {
    const pick = pickCheckIn({ now: NOW, week: WEEK, tasks: [office, legDay], placeName: gym });
    expect(pick).toEqual({ kind: "nearby", task: legDay, meters: 0, placeName: gym });
  });

  it("picks the Body task that clears a slot first, then the one worth more", () => {
    const bonus = task({ taskId: "bonus", source: "mystery", points: 90 });
    const small = task({ taskId: "small", points: 20 });
    const big = task({ taskId: "big", points: 50 });
    expect(pickCheckIn({ now: NOW, week: WEEK, tasks: [bonus, small], placeName: gym })?.task.taskId).toBe("small");
    expect(pickCheckIn({ now: NOW, week: WEEK, tasks: [small, big], placeName: gym })?.task.taskId).toBe("big");
  });

  it("is ignored when the name is not a gym, or no Body task is open and unpinned", () => {
    expect(pickCheckIn({ now: NOW, week: WEEK, tasks: [legDay], placeName: "2450 Mission St" })?.kind).toBe("at_risk");
    const noBody = [
      office,
      task({ taskId: "done", status: "verified" }),
      task({ taskId: "pinned", place: { name: "Track", lat: 37.9, lng: -122.5 } }),
      task({ taskId: "canvas", proofType: "canvas" }),
      task({ taskId: "laundry", slot: "chores", title: "Laundry" }),
    ];
    const pick = pickCheckIn({ now: NOW, week: WEEK, tasks: noBody, placeName: gym });
    expect(pick?.kind).toBe("at_risk");
  });

  it("yields to a live drop and to a pinned place within 30 m", () => {
    const pushUps = task({ taskId: "push", title: "20 push-ups", source: "drop", closesAt: NOW + HOUR });
    expect(pickCheckIn({ now: NOW, week: WEEK, tasks: [legDay, pushUps], placeName: gym })?.kind).toBe("drop");
    const nearOffice = { lat: 37.7579, lng: -122.3882 };
    const pick = pickCheckIn({ now: NOW, week: WEEK, tasks: [legDay, office], coords: nearOffice, placeName: gym });
    expect(pick?.kind === "nearby" && pick.task.taskId).toBe("office");
    expect(pick?.kind === "nearby" && pick.placeName).toBeUndefined();
  });
});

describe("arrivalPlace", () => {
  const phone = { lat: 37.7609, lng: -122.3884 };
  const pinned = { slot: "mind" as const, place: { name: "Library", ...phone } };
  const unpinnedBody = { slot: "body" as const };

  it("counts a pinned task within 30 m under the pin's own name, whatever the geocoder says", () => {
    expect(arrivalPlace({ task: pinned, phone, placeName: "Fitness SF" })).toBe("Library");
    expect(arrivalPlace({ task: pinned, phone: { lat: phone.lat + 0.0004, lng: phone.lng }, placeName: "Fitness SF" })).toBeNull();
  });

  it("counts an unpinned Body task only at a gym, under the geocoder's name", () => {
    expect(arrivalPlace({ task: unpinnedBody, phone, placeName: " Fitness SF " })).toBe("Fitness SF");
    // The name comes from the phone and is echoed into a text, so it is cut to 60 characters.
    expect(arrivalPlace({ task: unpinnedBody, phone, placeName: `Gym ${"x".repeat(200)}` })).toHaveLength(60);
    expect(arrivalPlace({ task: unpinnedBody, phone, placeName: "2450 Mission St" })).toBeNull();
    expect(arrivalPlace({ task: unpinnedBody, phone })).toBeNull();
  });

  it("never counts an unpinned task from another slot, or coordinates no phone could report", () => {
    expect(arrivalPlace({ task: { slot: "mind" }, phone, placeName: "Fitness SF" })).toBeNull();
    expect(arrivalPlace({ task: unpinnedBody, phone: { lat: Number.NaN, lng: 0 }, placeName: "Fitness SF" })).toBeNull();
  });
});

describe("slots", () => {
  it("counts a held proof and both slots of a group session as proven, but never a bonus task", () => {
    const proven = provenSlots([
      { slot: "mind", status: "held", source: "draft" },
      { slot: "body", status: "verified", source: "group" },
      { slot: "chores", status: "open", source: "draft" },
      { slot: "recharge", status: "verified", source: "drop" },
    ]);
    expect([...proven].sort()).toEqual(["body", "mind", "people"]);
  });

  it("lists the core slots still open, in roster order, and never flex", () => {
    const tasks = [
      { slot: "people", status: "open", source: "draft" },
      { slot: "flex", status: "open", source: "flex" },
      { slot: "body", status: "open", source: "draft" },
      { slot: "mind", status: "verified", source: "draft" },
      { slot: "mind", status: "open", source: "drop" },
      { slot: "chores", status: "open", source: "drop" },
    ] as const;
    expect(slotsAtStake(tasks)).toEqual(["body", "people"]);
  });
});

describe("pointsIfProven", () => {
  const TODAY = 20772; // any Pacific day number
  const legDay = task({ taskId: "leg" });

  it("adds the slot bonus and the day's streak bonus to the task's own points", () => {
    // 40 for the task, 25 for clearing Body, 5 for the first proof day of a run.
    expect(pointsIfProven(legDay, [legDay], [], TODAY)).toBe(70);
  });

  it("adds the sweep bonus when the task clears the fifth slot", () => {
    const others = (["mind", "recharge", "chores", "people"] as const).map((slot) =>
      task({ taskId: slot, slot, status: "verified" }),
    );
    // Proofs already landed today, so no new streak points: 40 + 25 + 100.
    expect(pointsIfProven(legDay, [legDay, ...others], [TODAY], TODAY)).toBe(165);
  });

  it("is only the task's points for a bonus task on a day that already has a proof", () => {
    const pushUps = task({ taskId: "push", source: "drop" });
    expect(pointsIfProven(pushUps, [pushUps], [TODAY], TODAY)).toBe(40);
  });
});

describe("hasArrived", () => {
  it("is true within 30 m of the pin and false beyond it", () => {
    expect(hasArrived(YC_OFFICE, YC_OFFICE)).toBe(true);
    expect(hasArrived({ lat: YC_OFFICE.lat + 0.0002, lng: YC_OFFICE.lng }, YC_OFFICE)).toBe(true);
    expect(hasArrived({ lat: YC_OFFICE.lat + 0.0004, lng: YC_OFFICE.lng }, YC_OFFICE)).toBe(false);
  });

  it("is false for coordinates no phone could report", () => {
    expect(hasArrived({ lat: Number.NaN, lng: YC_OFFICE.lng }, YC_OFFICE)).toBe(false);
  });
});

describe("pickRival", () => {
  const table = [
    { userId: "maya", name: "Maya Chen", points: 120 },
    { userId: "sam", name: "Sam", points: 105 },
    { userId: "me", name: "Me", points: 90 },
    { userId: "jo", name: "Jo", points: 60 },
  ];

  it("names the head-to-head opponent when there is one", () => {
    expect(pickRival("me", table, "jo")).toEqual({ userId: "jo", name: "Jo", gap: -30 });
  });

  it("otherwise names the player just ahead", () => {
    expect(pickRival("me", table)).toEqual({ userId: "sam", name: "Sam", gap: 15 });
  });

  it("names the chaser when the player leads", () => {
    expect(pickRival("maya", table)).toEqual({ userId: "sam", name: "Sam", gap: -15 });
  });

  it("has no rival alone in a league or outside it", () => {
    expect(pickRival("me", [table[2]])).toBeNull();
    expect(pickRival("stranger", table)).toBeNull();
  });
});

describe("passedBy", () => {
  const still = (userId: string, points: number) => ({ userId, before: points, after: points });

  it("finds the members the prover went past, with the new gap", () => {
    const others = [still("maya", 120), still("sam", 105), still("level", 90), still("jo", 60)];
    expect(passedBy({ prover: { before: 90, after: 110 }, others })).toEqual([
      { userId: "sam", gap: 5 },
      { userId: "level", gap: 20 },
    ]);
  });

  it("finds nobody when the proof only draws level or changes nothing", () => {
    const others = [still("sam", 105)];
    expect(passedBy({ prover: { before: 90, after: 105 }, others })).toEqual([]);
    expect(passedBy({ prover: { before: 110, after: 110 }, others })).toEqual([]);
  });

  it("does not count someone the prover was already ahead of, whose points then dropped", () => {
    const others = [{ userId: "sam", before: 80, after: 60 }];
    expect(passedBy({ prover: { before: 90, after: 110 }, others })).toEqual([]);
  });
});

describe("wording", () => {
  const legDay = task({ taskId: "leg" });
  const maya = { name: "Maya Chen", gap: 15 };

  it("leads the at-risk prompt with the rival and the gap, and says what the proof is worth against it", () => {
    const copy = (gap: number) =>
      promptCopy({ kind: "at_risk", task: legDay }, { now: NOW, rival: { name: "Maya Chen", gap }, worth: 65 });
    expect(copy(15)).toEqual({ label: "12H LEFT", line: "Maya's up 15. Leg day flips it." });
    expect(copy(65).line).toBe("Maya's up 65. Leg day ties it.");
    expect(copy(80).line).toBe("Maya's up 80. Leg day cuts it to 15.");
    expect(copy(-15).line).toBe("Maya's 15 back. Leg day makes it 80.");
    expect(copy(0).line).toBe("Tied with Maya. Leg day breaks the tie.");
  });

  it("still asks when the player has no rival", () => {
    expect(promptCopy({ kind: "at_risk", task: legDay }, { now: NOW, rival: null, worth: 65 }).line).toBe(
      "Leg day is open. +40.",
    );
  });

  it("shows a drop's countdown and a pinned place's name", () => {
    const pushUps = task({ taskId: "push", title: "20 push-ups", source: "drop", closesAt: NOW + 47 * 60 * 1000 });
    expect(promptCopy({ kind: "drop", task: pushUps }, { now: NOW, rival: maya, worth: 45 })).toEqual({
      label: "LIVE 47M",
      line: "20 push-ups, +40. Maya's up 15.",
    });
    const office = task({ taskId: "office", place: YC_OFFICE });
    expect(promptCopy({ kind: "nearby", task: office, meters: 20 }, { now: NOW, rival: maya, worth: 65 })).toEqual({
      label: "HERE",
      line: "You're at YC office. Check in?",
    });
  });

  it("names the gym the phone reports for an unpinned task, but a pin's own name when there is no report", () => {
    const unpinned = task({ taskId: "leg" });
    expect(
      promptCopy({ kind: "nearby", task: unpinned, meters: 0, placeName: "Fitness SF" }, { now: NOW, rival: maya, worth: 65 }),
    ).toEqual({ label: "HERE", line: "You're at Fitness SF. Check in?" });
    expect(promptCopy({ kind: "nearby", task: unpinned, meters: 0 }, { now: NOW, rival: maya, worth: 65 }).line).toBe(
      "You're at the spot. Check in?",
    );
  });

  it("tells a player who plays by text that a reply is enough on arrival", () => {
    expect(arrivalText("Fitness SF")).toBe("You're at Fitness SF. Reply with a photo to check in.");
  });

  it("writes time left like a ticker", () => {
    expect(shortDuration(20 * 1000)).toBe("1M");
    expect(shortDuration(59 * 60 * 1000)).toBe("59M");
    expect(shortDuration(9.9 * HOUR)).toBe("9H");
    expect(shortDuration(47 * HOUR)).toBe("47H");
    expect(shortDuration(60 * HOUR)).toBe("2D");
  });

  it("texts the evening nudge, and sends location and Canvas tasks to the app", () => {
    expect(eveningText(legDay, null)).toBe("Leg day isn't on the board yet. Reply with a photo.");
    expect(eveningText(legDay, maya)).toBe("Leg day isn't on the board yet. Maya's up 15. Reply with a photo.");
    expect(eveningText({ title: "Ship the demo", proofType: "photo_location" }, null)).toBe(
      "Ship the demo isn't on the board yet. Check in from the app.",
    );
    expect(eveningText({ title: "Problem set 4", proofType: "canvas" }, null)).toBe(
      "Problem set 4 isn't on the board yet. Verify it in the app.",
    );
  });

  it("lists the open slots and the dollars at stake on the last day", () => {
    expect(lastDayText({ slots: ["body", "chores", "people"], stakeUsd: 20, rival: maya })).toBe(
      "Last day. Body, Chores and People are still open. $20 is on the line. Maya's up 15.",
    );
    expect(lastDayText({ slots: ["mind"], stakeUsd: 7.5, rival: null })).toBe("Last day. Mind is still open. $7.50 is on the line.");
    expect(lastDayText({ slots: ["body", "mind"], stakeUsd: 0, rival: null })).toBe("Last day. Body and Mind are still open.");
  });

  it("names who passed the player, by how much, and the way back", () => {
    const wayBack = { ...legDay, worth: 65 };
    expect(passedText({ rivalName: "Maya Chen", gap: 15, leagueName: "YC Hackathon", wayBack })).toBe(
      "Maya just passed you in YC Hackathon, up 15. Leg day flips it. Reply with a photo.",
    );
    expect(passedText({ rivalName: "Maya", gap: 90, leagueName: "YC Hackathon", wayBack })).toBe(
      "Maya just passed you in YC Hackathon, up 90. Leg day cuts it to 25. Reply with a photo.",
    );
    expect(passedText({ rivalName: "Maya", gap: 15, leagueName: "YC Hackathon", wayBack: null })).toBe(
      "Maya just passed you in YC Hackathon, up 15.",
    );
  });
});

describe("when the agent may text", () => {
  it("never texts between 10 PM and 8 AM Pacific", () => {
    expect([21, 22, 23, 0, 3, 7, 8].map((hour) => mayText(hour, 0))).toEqual([true, false, false, false, false, false, true]);
  });

  it("stops at three texts a day", () => {
    expect(mayText(12, 2)).toBe(true);
    expect(mayText(12, 3)).toBe(false);
  });

  const due = (over: Partial<Parameters<typeof scheduledNudge>[0]>) =>
    scheduledNudge({
      now: NOW,
      pacificHour: 12,
      weekEndsAt: NOW + 5 * 24 * HOUR,
      sentToday: [],
      provedToday: false,
      slotsAtStake: 2,
      hasCheckIn: true,
      ...over,
    });

  it("sends the evening text from 6 PM when nothing was proven today", () => {
    expect(due({ pacificHour: 17 })).toBeNull();
    expect(due({ pacificHour: 18 })).toBe("evening");
    expect(due({ pacificHour: 21 })).toBe("evening");
    expect(due({ pacificHour: 22 })).toBeNull();
  });

  it("skips the evening text after a proof, when nothing is left to prove, or when already sent", () => {
    expect(due({ pacificHour: 18, provedToday: true })).toBeNull();
    expect(due({ pacificHour: 18, hasCheckIn: false })).toBeNull();
    expect(due({ pacificHour: 18, sentToday: ["evening"] })).toBeNull();
  });

  it("sends the last-day text once, from 10 AM on the final day, while a slot is at stake", () => {
    const lastDay = { weekEndsAt: NOW + 12 * HOUR };
    expect(due({ ...lastDay, pacificHour: 9 })).toBeNull();
    expect(due({ ...lastDay, pacificHour: 10 })).toBe("last_day");
    expect(due({ ...lastDay, pacificHour: 10, provedToday: true })).toBe("last_day");
    expect(due({ ...lastDay, pacificHour: 10, slotsAtStake: 0 })).toBeNull();
    expect(due({ ...lastDay, pacificHour: 12, sentToday: ["last_day"] })).toBeNull();
    expect(due({ pacificHour: 12 })).toBeNull();
  });

  it("sends the last-day text first and the evening text after it", () => {
    const lastEvening = { weekEndsAt: NOW + 6 * HOUR, pacificHour: 18 };
    expect(due(lastEvening)).toBe("last_day");
    expect(due({ ...lastEvening, sentToday: ["last_day"] })).toBe("evening");
  });

  it("sends nothing past the cap or after the week ends", () => {
    expect(due({ pacificHour: 18, sentToday: ["rival_passed", "rival_passed", "rival_passed"] })).toBeNull();
    expect(due({ pacificHour: 18, weekEndsAt: NOW })).toBeNull();
  });
});

describe("pacificClock", () => {
  it("reads the day and hour in Los Angeles, in winter and in summer", () => {
    expect(pacificClock(Date.UTC(2026, 10, 15, 20, 30, 15))).toEqual({ day: "2026-11-15", hour: 12 });
    // 05:30 UTC on 1 July is still 30 June, 10:30 PM, in Los Angeles (UTC-7).
    expect(pacificClock(Date.UTC(2026, 6, 1, 5, 30))).toEqual({ day: "2026-06-30", hour: 22 });
  });

  it("calls midnight hour 0 of the new day", () => {
    expect(pacificClock(Date.UTC(2026, 10, 16, 8, 0))).toEqual({ day: "2026-11-16", hour: 0 });
  });
});
