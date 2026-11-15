// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

import {
  bestProof,
  biggestComeback,
  buildCards,
  fastestQuickTime,
  formatDuration,
  ordinal,
  pickWeek,
  type Entry,
} from "./wrapped";

const modules = import.meta.glob("./**/*.ts");

const DAY = 24 * 60 * 60 * 1000;
const WEEK = Date.UTC(2026, 10, 9, 8); // Monday 00:00 in Los Angeles

function entry(overrides: Partial<Entry>): Entry {
  return {
    userId: "maya",
    name: "Maya",
    taskTitle: "Leg day",
    points: 30,
    provedAt: WEEK + 1000,
    highlight: 5,
    confidence: 0.9,
    caption: "Squat rack conquered",
    ...overrides,
  };
}

describe("bestProof", () => {
  it("picks the highest highlight", () => {
    const top = entry({ highlight: 9, caption: "Summit selfie" });
    expect(bestProof([entry({ highlight: 4 }), top, entry({ highlight: 7 })])).toBe(top);
  });
  it("breaks a tie on the referee's confidence", () => {
    const sure = entry({ highlight: 8, confidence: 0.97 });
    expect(bestProof([entry({ highlight: 8, confidence: 0.7 }), sure])).toBe(sure);
  });
  it("is null with no proofs", () => {
    expect(bestProof([])).toBeNull();
  });
});

describe("fastestQuickTime", () => {
  it("finds the quickest answer to a drop and ignores ordinary proofs", () => {
    const slow = entry({ quickTime: { title: "20 push-ups", opensAt: WEEK }, provedAt: WEEK + 300_000 });
    const fast = entry({ userId: "sam", quickTime: { title: "20 push-ups", opensAt: WEEK }, provedAt: WEEK + 42_000 });
    expect(fastestQuickTime([entry({}), slow, fast])).toEqual({ entry: fast, seconds: 42 });
  });
  it("is null when nobody answered a drop", () => {
    expect(fastestQuickTime([entry({})])).toBeNull();
  });
});

describe("biggestComeback", () => {
  const members = ["maya", "sam", "lee"];
  it("finds the member who climbed furthest from their worst day", () => {
    const scores = [
      { userId: "maya", points: 50, provedAt: WEEK + 1 }, // Monday: Maya leads, Lee is 2nd level with Sam
      { userId: "sam", points: 30, provedAt: WEEK + DAY + 1 }, // Tuesday: Lee drops to 3rd
      { userId: "lee", points: 90, provedAt: WEEK + 3 * DAY + 1 }, // Thursday: Lee takes the lead
    ];
    expect(biggestComeback(scores, members, WEEK)).toEqual({ userId: "lee", from: 3, to: 1 });
  });
  it("is null when the order never changed", () => {
    const scores = [
      { userId: "maya", points: 50, provedAt: WEEK + 1 },
      { userId: "maya", points: 20, provedAt: WEEK + 2 * DAY },
    ];
    expect(biggestComeback(scores, members, WEEK)).toBeNull();
  });
  it("is null before anyone has scored", () => {
    expect(biggestComeback([], members, WEEK)).toBeNull();
  });
});

describe("formatting", () => {
  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "103rd",
    ]);
  });
  it("writes durations short", () => {
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(185)).toBe("3m 05s");
    expect(formatDuration(4320)).toBe("1h 12m");
  });
});

describe("pickWeek", () => {
  const weeks = [
    { number: 1, status: "settled" },
    { number: 2, status: "settled" },
    { number: 3, status: "open" },
  ] as const;
  it("returns the week asked for", () => {
    expect(pickWeek([...weeks], 1)?.number).toBe(1);
    expect(pickWeek([...weeks], 9)).toBeNull();
  });
  it("defaults to the latest settled week", () => {
    expect(pickWeek([...weeks])?.number).toBe(2);
  });
  it("falls back to the week in progress before the first settlement", () => {
    expect(pickWeek([{ number: 1, status: "open" }])?.number).toBe(1);
  });
});

describe("buildCards", () => {
  const standings = [
    { userId: "maya", name: "Maya", points: 80, slotsCleared: 2 },
    { userId: "sam", name: "Sam", points: 120, slotsCleared: 4 },
    { userId: "lee", name: "Lee", points: 0, slotsCleared: 0 },
  ];
  const entries = [
    entry({ userId: "maya", name: "Maya", points: 50, highlight: 6, provedAt: WEEK + 1 }),
    entry({ userId: "maya", name: "Maya", points: 30, highlight: 3, provedAt: WEEK + DAY + 1 }),
    entry({
      userId: "sam", name: "Sam", points: 120, highlight: 9, caption: "Three fingers up, mid push-up",
      provedAt: WEEK + 2 * DAY + 42_000, quickTime: { title: "20 push-ups", opensAt: WEEK + 2 * DAY },
    }),
  ];

  it("returns the five cards in story order", () => {
    const cards = buildCards({ standings, entries, viewerId: "maya", weekStart: WEEK });
    expect(cards.map((card) => card.kind)).toEqual(["champion", "best_proof", "comeback", "fastest", "your_week"]);
    expect(cards[0]).toMatchObject({ subtitle: "Sam · 40 ahead of Maya", stat: "120 pts" });
    expect(cards[1]).toMatchObject({ subtitle: "Sam · Three fingers up, mid push-up", stat: "9/10" });
    expect(cards[2]).toMatchObject({ subtitle: "Sam climbed from 2nd to 1st", stat: "+1" });
    expect(cards[3]).toMatchObject({ subtitle: "Sam · 20 push-ups", stat: "42s" });
    expect(cards[4]).toMatchObject({ subtitle: "2/5 slots · 2 proofs", stat: "80 pts" });
  });

  it("still returns five honest cards for a week with no proofs", () => {
    const empty = standings.map((s) => ({ ...s, points: 0, slotsCleared: 0 }));
    const cards = buildCards({ standings: empty, entries: [], viewerId: "lee", weekStart: WEEK });
    expect(cards).toHaveLength(5);
    expect(cards.slice(0, 4).every((card) => card.stat === "—")).toBe(true);
    expect(cards[4]).toMatchObject({ subtitle: "0/5 slots · 0 proofs", stat: "0 pts" });
  });
});

describe("wrapped.get", () => {
  async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const [maya, sam, lee, olu] = await Promise.all(
        ["Maya", "Sam", "Lee", "Olu"].map((name) => ctx.db.insert("users", { name })),
      );
      const leagueId = await ctx.db.insert("leagues", {
        name: "YC", inviteCode: "YC", stakeUsd: 5, visibility: "private", maxMembers: 8, createdBy: maya,
      });
      for (const userId of [maya, sam, lee]) {
        await ctx.db.insert("memberships", { leagueId, userId, paid: true, joinedAt: WEEK });
      }
      await ctx.db.insert("weeks", { leagueId, number: 1, startsAt: WEEK, endsAt: WEEK + 7 * DAY, status: "open" });
      const dropId = await ctx.db.insert("drops", {
        leagueId, kind: "quicktime", title: "20 push-ups", slot: "body", points: 40,
        opensAt: WEEK + 2 * DAY, closesAt: WEEK + 2 * DAY + 7_200_000, status: "closed",
      });
      const photo = await ctx.storage.store(new Blob(["photo"]));
      const prove = async (
        userId: Id<"users">,
        task: { slot: "body" | "mind" | "chores"; title: string; points: number; dropId?: Id<"drops"> },
        proof: { createdAt: number; highlight: number; caption: string; storageId?: Id<"_storage"> },
      ) => {
        const taskId = await ctx.db.insert("tasks", {
          userId, weekStart: WEEK, proofType: "photo", status: "verified",
          source: task.dropId ? "drop" : "draft", ...task,
        });
        await ctx.db.insert("proofs", {
          taskId, userId, weekStart: WEEK, mediaType: "photo", pass: true, confidence: 0.9,
          reason: "ok", via: "app", ...proof,
        });
      };
      // Monday: Maya leads. Tuesday: Sam passes Lee. Wednesday: Lee answers the drop in 42 seconds
      // and adds a big task on Thursday to take the lead.
      await prove(maya, { slot: "body", title: "Leg day", points: 50 }, { createdAt: WEEK + 1, highlight: 6, caption: "Squat rack conquered" });
      await prove(sam, { slot: "mind", title: "Problem set", points: 30 }, { createdAt: WEEK + DAY + 1, highlight: 4, caption: "Proofs on proofs" });
      await prove(lee, { slot: "body", title: "20 push-ups", points: 40, dropId }, { createdAt: WEEK + 2 * DAY + 42_000, highlight: 9, caption: "Three fingers up", storageId: photo });
      await prove(lee, { slot: "chores", title: "Deep clean", points: 45 }, { createdAt: WEEK + 3 * DAY + 1, highlight: 5, caption: "Spotless" });
      return { maya, sam, lee, olu, leagueId };
    });
    const as = (userId: Id<"users">) => t.withIdentity({ subject: userId + "|test-session" });
    return { t, as, ...ids };
  }

  it("builds the five cards from the week's real data", async () => {
    const { as, maya, leagueId } = await setup();
    const { cards } = await as(maya).query(api.wrapped.get, { leagueId });

    expect(cards.map((card) => [card.kind, card.subtitle, card.stat])).toEqual([
      // Points follow the standings' rules: task points, +25 a cleared slot, the streak bonus.
      ["champion", "Lee · 45 ahead of Maya", "125 pts"],
      ["best_proof", "Lee · Three fingers up", "9/10"],
      ["comeback", "Lee climbed from 3rd to 1st", "+2"],
      ["fastest", "Lee · 20 push-ups", "42s"],
      ["your_week", "1/5 slots · 1 proof", "80 pts"],
    ]);
    // Lee's drop photo backs the cards it earned; Maya's proof had no media.
    expect(cards[1]).toMatchObject({ mediaUrl: expect.any(String), mediaType: "photo" });
    expect(cards[4].mediaUrl).toBeUndefined();
  });

  it("shows the table's points once the week has settled, matchup bonus included", async () => {
    const { t, as, maya, lee, leagueId } = await setup();
    await t.run(async (ctx) => {
      const week = (await ctx.db.query("weeks").first())!;
      await ctx.db.insert("matchups", { weekId: week._id, userA: lee, userB: maya });
      await ctx.db.patch("weeks", week._id, { status: "settled" });
    });
    const table = await as(maya).query(api.standings.table, { leagueId });
    const { cards } = await as(maya).query(api.wrapped.get, { leagueId });

    // Lee beat Maya head to head: 125 + 50.
    expect(table[0]).toMatchObject({ userId: lee, points: 175 });
    expect([cards[0].subtitle, cards[0].stat]).toEqual(["Lee · 95 ahead of Maya", "175 pts"]);
  });

  it("finds a week by number and returns no cards for a week that never happened", async () => {
    const { as, sam, leagueId } = await setup();
    expect((await as(sam).query(api.wrapped.get, { leagueId, weekNumber: 1 })).cards).toHaveLength(5);
    expect((await as(sam).query(api.wrapped.get, { leagueId, weekNumber: 7 })).cards).toEqual([]);
  });

  it("returns no cards to someone outside the league", async () => {
    const { as, olu, leagueId } = await setup();
    expect((await as(olu).query(api.wrapped.get, { leagueId })).cards).toEqual([]);
  });
});
