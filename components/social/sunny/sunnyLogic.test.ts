import { describe, expect, it } from "vitest";

import type { Matchup } from "../contract";
import { parseReply, sunnyBrief, timeLeft, verdictLine } from "./sunnyLogic";

const HOUR = 60 * 60 * 1000;
const task = (slot: "body" | "mind" | "chores", points: number, status: "open" | "verified") =>
  ({ slot, points, status }) as unknown as NonNullable<Matchup["rows"][number]["mine"]>;

const matchup = (mine: number, theirs: number): Matchup =>
  ({
    me: { name: "Ana Lee", total: mine },
    opponent: { name: "Sam Ortiz", total: theirs },
    rows: [
      { slot: "body", mine: task("body", 20, "verified") },
      { slot: "mind", mine: task("mind", 30, "open") },
      { slot: "chores", mine: task("chores", 10, "open") },
    ],
  }) as unknown as Matchup;

describe("sunnyBrief", () => {
  const now = 1_000_000;
  const open = { status: "open" as const, endsAt: now + 49 * HOUR };

  it("names the gap, the time left and my biggest open slot when I'm behind", () => {
    const brief = sunnyBrief(matchup(60, 100), open, now);
    expect(brief?.line).toBe("Sam's 40 up with 2 days left. Your Mind slot is the swing: 30 pts.");
    expect(brief?.chips).toEqual(["How do I catch up?", "Swap that task", "Trash talk"]);
  });

  it("talks about holding on when I lead", () => {
    expect(sunnyBrief(matchup(100, 60), open, now)?.chips[0]).toBe("How do I hold on?");
  });

  it("calls a finished week", () => {
    const brief = sunnyBrief(matchup(100, 60), { status: "settled", endsAt: now - 1 }, now);
    expect(brief?.line).toBe("Week's done. You beat Sam, 100–60.");
  });

  it("is nothing without a matchup", () => {
    expect(sunnyBrief(null, open, now)).toBeNull();
  });

  it("rounds time coarsely", () => {
    expect(timeLeft(5 * HOUR)).toBe("5h left");
    expect(timeLeft(10 * 60 * 1000)).toBe("under an hour left");
  });
});

describe("verdictLine", () => {
  it("says what the proof earned and where the matchup stands", () => {
    expect(verdictLine(40, matchup(175, 100))).toBe("Clean proof. +40, you're up 75 on Sam.");
    expect(verdictLine(40, matchup(60, 100))).toBe("Clean proof. +40, Sam's lead is down to 40.");
    expect(verdictLine(40, null)).toBe("Clean proof. +40.");
  });
});

describe("parseReply", () => {
  it("strips a trailing action tag into an action", () => {
    expect(parseReply("Swap it.\n[action:swap]")).toEqual({ text: "Swap it.", action: { kind: "swap" } });
    expect(parseReply("Poke him.\n[action:nudge:Sam]")).toEqual({ text: "Poke him.", action: { kind: "nudge", name: "Sam" } });
  });

  it("leaves a plain reply alone", () => {
    expect(parseReply("You're up 40.")).toEqual({ text: "You're up 40." });
  });
});
