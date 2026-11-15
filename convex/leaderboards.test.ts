/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { sameStats, winnings } from "./leaderboards";
import { DAY_MS, weekStartOf } from "./lib/week";
import { NO_STATS } from "./lib/weekTally";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Sunday 15 November 2026, 2:30 PM Pacific: the last afternoon of the week, as in the demo.
const NOW = new Date("2026-11-15T22:30:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

type Harness = TestConvex<typeof schema>;

/**
 * The demo league, seeded: on a Sunday the table reads Maya 500, Sam 285,
 * Priya 195, Jordan 120, Ava 60, Leo 0 (convex/seed.ts).
 */
async function seededLeague() {
  const t = convexTest(schema, modules);
  await t.mutation(api.seed.reset, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const players = await t.query(api.seed.players, {});
  const idOf = (firstName: string) => players.find((player) => player.name.startsWith(firstName))!._id;
  const leagueId = await t.run(async (ctx) => {
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", "YCHACK"))
      .unique();
    return league!._id;
  });
  const as = (firstName: string) => t.withIdentity({ subject: `${idOf(firstName)}|session` });
  return { t, leagueId, idOf, as };
}

/** Verifies one of a player's open tasks with a proof made right now. */
async function prove(t: Harness, userId: Id<"users">, slot: string) {
  await t.run(async (ctx) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", weekStartOf(NOW)))
      .collect();
    const task = tasks.find((row) => row.slot === slot && row.status === "open")!;
    await ctx.db.patch("tasks", task._id, { status: "verified" });
    await ctx.db.insert("proofs", {
      taskId: task._id,
      userId,
      weekStart: task.weekStart,
      mediaType: "photo",
      pass: true,
      confidence: 0.9,
      reason: "Looks right.",
      highlight: 6,
      caption: "Done.",
      via: "app",
      createdAt: Date.now(),
    });
  });
}

describe("leaderboards.board", () => {
  test("This Week matches the seeded standings, with gaps and the caller's rival", async () => {
    const { leagueId, as, idOf } = await seededLeague();
    const result = await as("Priya").query(api.leaderboards.board, { leagueId, board: "week" });

    expect(result.title).toBe("This Week");
    expect(result.rows.map((row) => [row.rank, row.name, row.value])).toEqual([
      [1, "Maya Chen", 500],
      [2, "Sam Patel", 285],
      [3, "Priya Shah", 195],
      [4, "Jordan Lee", 120],
      [5, "Ava Kim", 60],
      [6, "Leo Martinez", 0],
    ]);
    const priya = result.rows[2];
    expect(priya).toMatchObject({ isMe: true, gapLabel: "90 behind Sam Patel", detail: "3/5 slots" });
    expect(result.rows[0].gapLabel).toBe("215 ahead of Sam Patel");
    // Jordan is 75 behind, Sam 90 ahead: the nearer one is the rival.
    expect(result.rival).toEqual({ userId: idOf("Jordan"), name: "Jordan Lee", label: "Jordan Lee is 75 behind you" });
    expect(result.rows.map((row) => row.isRival)).toEqual([false, false, false, true, false, false]);
  });

  test("a new proof reorders the board at once and shows as movement", async () => {
    const { t, leagueId, as, idOf } = await seededLeague();
    // Leo's gym session: 35 for the task, 25 for the slot, 5 for the day.
    await prove(t, idOf("Leo"), "body");

    const { rows } = await as("Ava").query(api.leaderboards.board, { leagueId, board: "week" });
    expect(rows.slice(4).map((row) => [row.rank, row.name, row.value, row.movement])).toEqual([
      [5, "Leo Martinez", 65, 1],
      [6, "Ava Kim", 60, -1],
    ]);
  });

  test("slot, streak, proof and quick-time boards rank the same week by other numbers", async () => {
    const { leagueId, as } = await seededLeague();
    const viewer = as("Maya");
    const top = async (board: "body" | "streak" | "highlights" | "quickTime") => {
      const result = await viewer.query(api.leaderboards.board, { leagueId, board });
      return result.rows.map((row) => [row.name, row.valueLabel]);
    };

    // Sam's Body points are the bike ride and the quick-time push-ups with the first-finisher bonus.
    expect((await top("body"))[0]).toEqual(["Sam Patel", "80"]);
    // Maya proved something six days running, Monday to Saturday.
    expect((await top("streak"))[0]).toEqual(["Maya Chen", "6"]);
    // Only players with a verified proof are on the proofs board; Leo's was turned down.
    const proofs = await viewer.query(api.leaderboards.board, { leagueId, board: "highlights" });
    expect(proofs.rows.map((row) => row.name)).not.toContain("Leo Martinez");
    expect(proofs.rows[0]).toMatchObject({ name: "Maya Chen", valueLabel: "9/10", detail: "Pasta night with the crew." });
    // The drop opened at 2:00 PM and Sam answered at 2:12.
    expect(await top("quickTime")).toEqual([["Sam Patel", "12m 00s"]]);
  });

  test("head-to-head shows the matchup in play", async () => {
    const { leagueId, as } = await seededLeague();
    const { rows } = await as("Sam").query(api.leaderboards.board, { leagueId, board: "headToHead" });
    // The seeded season has four finished weeks: Sam won all four and Maya lost one.
    expect(rows[0]).toMatchObject({ name: "Sam Patel", valueLabel: "4-0", detail: "Trailing Maya Chen 285-500" });
    expect(rows[1]).toMatchObject({ name: "Maya Chen", valueLabel: "3-1", detail: "Leading Sam Patel 500-285" });
    expect(rows.find((row) => row.isMe)?.detail).toBe("Trailing Maya Chen 285-500");
  });

  test("season and all-time add finished weeks from the stored rows to the week in play", async () => {
    const { t, leagueId, as, idOf } = await seededLeague();
    const lastWeek = weekStartOf(NOW) - 7 * DAY_MS;
    // Make the seeded week the league's second, and give Leo a strong first one.
    await t.run(async (ctx) => {
      const [thisWeek] = await ctx.db
        .query("weeks")
        .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
        .collect();
      await ctx.db.patch("weeks", thisWeek._id, { number: 2 });
      await ctx.db.insert("weeks", {
        leagueId,
        number: 1,
        startsAt: lastWeek,
        endsAt: weekStartOf(NOW),
        status: "settled",
      });
      const taskId = await ctx.db.insert("tasks", {
        userId: idOf("Leo"),
        weekStart: lastWeek,
        slot: "mind",
        title: "Finish the lab report",
        points: 40,
        proofType: "photo",
        status: "verified",
        source: "draft",
      });
      await ctx.db.insert("proofs", {
        taskId,
        userId: idOf("Leo"),
        weekStart: lastWeek,
        mediaType: "photo",
        pass: true,
        confidence: 0.9,
        reason: "A finished report.",
        highlight: 10,
        caption: "Submitted with a minute to spare.",
        via: "app",
        createdAt: lastWeek + DAY_MS,
      });
    });
    await t.mutation(internal.leaderboards.rebuild, { leagueId });

    const viewer = as("Leo");
    const points = async (board: "week" | "season" | "allTime") => {
      const { rows } = await viewer.query(api.leaderboards.board, { leagueId, board });
      return rows.find((row) => row.isMe)?.value;
    };
    expect(await points("week")).toBe(0);
    // Last week: 40 for the task, 25 for the slot, 5 for the day.
    expect(await points("season")).toBe(70);
    expect(await points("allTime")).toBe(70);

    const proofs = await viewer.query(api.leaderboards.board, { leagueId, board: "highlights" });
    expect(proofs.rows[0]).toMatchObject({ name: "Leo Martinez", valueLabel: "10/10" });
  });

  test("the global boards rank the stored rows across leagues", async () => {
    const { t, leagueId, as } = await seededLeague();
    const viewer = as("Jordan");
    // Start from nothing stored, as on a league no writer has touched yet.
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("scores").collect()) await ctx.db.delete("scores", row._id);
    });
    expect((await viewer.query(api.leaderboards.board, { leagueId, board: "global" })).rows).toEqual([]);

    // Opening the Leaderboards screen is what asks for the rebuild.
    await viewer.mutation(api.leaderboards.sync, { leagueId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    for (const board of ["global", "globalAllTime"] as const) {
      const { rows } = await viewer.query(api.leaderboards.board, { leagueId, board });
      expect(rows.map((row) => [row.name, row.value])).toEqual([
        ["Maya Chen", 500],
        ["Sam Patel", 285],
        ["Priya Shah", 195],
        ["Jordan Lee", 120],
        ["Ava Kim", 60],
        ["Leo Martinez", 0],
      ]);
      expect(rows[0].detail).toBe("YC Hackathon");
    }
  });

  test("rebuilding twice writes nothing the second time", async () => {
    const { t, leagueId } = await seededLeague();
    await t.mutation(internal.leaderboards.rebuild, { leagueId });
    const before = await t.run((ctx) => ctx.db.query("scores").collect());
    await t.mutation(internal.leaderboards.rebuild, { leagueId });
    const after = await t.run((ctx) => ctx.db.query("scores").collect());
    // Six week rows and six all-time rows, untouched by the second run.
    expect(after).toHaveLength(12);
    expect(after).toEqual(before);
  });

  test("refresh rebuilds one player's week after a proof", async () => {
    const { t, leagueId, as, idOf } = await seededLeague();
    await t.mutation(internal.leaderboards.rebuild, { leagueId });
    await prove(t, idOf("Leo"), "body");
    await t.mutation(internal.leaderboards.refresh, { userId: idOf("Leo"), weekStart: weekStartOf(NOW) });

    const { rows } = await as("Leo").query(api.leaderboards.board, { leagueId, board: "global" });
    expect(rows.find((row) => row.isMe)).toMatchObject({ rank: 5, value: 65, movement: 1 });
  });
});

describe("keeping the stored rows current", () => {
  test("a seed reset rebuilds the league's rows", async () => {
    const { t } = await seededLeague();
    const rows = await t.run((ctx) => ctx.db.query("scores").collect());
    expect(rows.filter((row) => row.weekStart !== 0).map((row) => row.points).sort((a, b) => b - a)).toEqual([
      500, 285, 195, 120, 60, 0,
    ]);
  });

  test("a verified proof refreshes the player's stored week", async () => {
    const { t, leagueId, as, idOf } = await seededLeague();
    const leo = idOf("Leo");
    const { taskId, storageId } = await t.run(async (ctx) => {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_user_week", (q) => q.eq("userId", leo).eq("weekStart", weekStartOf(NOW)))
        .collect();
      return {
        taskId: tasks.find((task) => task.slot === "mind")!._id,
        storageId: await ctx.storage.store(new Blob(["a photo"])),
      };
    });
    await t.mutation(internal.proofs.record, {
      taskId,
      userId: leo,
      storageId,
      mediaType: "photo",
      via: "app",
      verdict: { pass: true, confidence: 0.9, reason: "A finished report.", highlight: 7, caption: "Done.", points: 40, closeCall: false },
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    // 40 for the task, 25 for the slot, 5 for the day: past Ava's 60 on the global board, which only reads stored rows.
    const { rows } = await as("Leo").query(api.leaderboards.board, { leagueId, board: "global" });
    expect(rows.find((row) => row.isMe)).toMatchObject({ rank: 5, value: 70, movement: 1 });
  });

  test("a rebuild drops the rows of a player who left and of a week that was removed", async () => {
    const { t, leagueId, idOf } = await seededLeague();
    await t.run(async (ctx) => {
      const ava = await ctx.db
        .query("memberships")
        .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", idOf("Ava")))
        .unique();
      await ctx.db.delete("memberships", ava!._id);
      const maya = await ctx.db
        .query("scores")
        .withIndex("by_league_week_user", (q) =>
          q.eq("leagueId", leagueId).eq("weekStart", weekStartOf(NOW)).eq("userId", idOf("Maya")),
        )
        .unique();
      // A row for a week the league no longer has.
      const { _id, _creationTime, ...row } = maya!;
      await ctx.db.insert("scores", { ...row, weekStart: weekStartOf(NOW) - 7 * DAY_MS });
    });
    await t.mutation(internal.leaderboards.rebuild, { leagueId });

    const rows = await t.run((ctx) => ctx.db.query("scores").collect());
    expect(rows.some((row) => row.userId === idOf("Ava"))).toBe(false);
    expect(rows.filter((row) => row.userId === idOf("Maya")).map((row) => row.points)).toEqual([500, 500]);
  });
});

describe("leaderboards.projection", () => {
  test("pays the only finisher the forfeited stakes if the week ended now", async () => {
    const { leagueId, as } = await seededLeague();
    const projection = await as("Maya").query(api.leaderboards.projection, { leagueId, at: NOW });
    // Maya has cleared all five. The other five forfeit $20 each, less the 10% fee.
    expect(projection).toMatchObject({ eligible: true, stakeUsd: 20, ifEndedNowUsd: 110, finishProbability: 1 });
    expect(projection!.lowUsd).toBeLessThanOrEqual(projection!.expectedUsd);
    expect(projection!.expectedUsd).toBeLessThanOrEqual(projection!.highUsd);
    expect(projection!.label).toMatch(/^Projected: \+\$\d+\.\d\d$/);
  });

  test("shows a player who has not finished what they stand to lose", async () => {
    const { leagueId, as } = await seededLeague();
    const projection = await as("Leo").query(api.leaderboards.projection, { leagueId, at: NOW });
    expect(projection).toMatchObject({ eligible: true, ifEndedNowUsd: 0 });
    expect(projection!.label).toMatch(/^Projected: -\$/);
  });

  test("is null in a free league and for someone who is not a member", async () => {
    const { t, leagueId, as } = await seededLeague();
    const outsider = await t.run((ctx) => ctx.db.insert("users", { name: "Visitor" }));
    const visitor = t.withIdentity({ subject: `${outsider}|session` });
    expect(await visitor.query(api.leaderboards.projection, { leagueId, at: NOW })).toBeNull();

    await t.run((ctx) => ctx.db.patch("leagues", leagueId, { stakeUsd: 0 }));
    expect(await as("Maya").query(api.leaderboards.projection, { leagueId, at: NOW })).toBeNull();
  });

  test("the money board lists winnings and breaks ties with the projection", async () => {
    const { t, leagueId, as, idOf } = await seededLeague();
    const viewer = as("Sam");
    const before = await viewer.query(api.leaderboards.board, { leagueId, board: "money" });
    expect(before.rows[0]).toMatchObject({ name: "Maya Chen", valueLabel: "$0.00" });
    expect(before.rows[0].detail).toMatch(/^Projected: \+\$/);

    await t.run(async (ctx) => {
      const [week] = await ctx.db
        .query("weeks")
        .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
        .collect();
      await ctx.db.insert("ledger", {
        leagueId,
        weekId: week._id,
        userId: idOf("Sam"),
        kind: "winnings",
        amountUsd: 12.4,
        idempotencyKey: "test:winnings",
        createdAt: Date.now(),
      });
    });
    const after = await viewer.query(api.leaderboards.board, { leagueId, board: "money" });
    expect(after.rows[0]).toMatchObject({ name: "Sam Patel", valueLabel: "$12.40", isMe: true, movement: 1 });
  });
});

describe("winnings", () => {
  test("sums winnings rows per player and ignores every other kind", () => {
    const row = (userId: string, kind: "buy_in" | "refund" | "winnings" | "fee", amountUsd: number, createdAt = 1) => ({
      userId: userId as Id<"users">,
      kind,
      amountUsd,
      createdAt,
    });
    const ledger = [row("maya", "buy_in", 20), row("maya", "refund", 20), row("maya", "winnings", 4.1), row("maya", "winnings", 0.2, 5)];
    expect(winnings(ledger)).toEqual(new Map([["maya", 4.3]]));
    expect(winnings(ledger, 5)).toEqual(new Map([["maya", 4.1]]));
  });
});

describe("sameStats", () => {
  test("compares every number a board can rank by", () => {
    expect(sameStats(NO_STATS, { ...NO_STATS, slotPoints: { ...NO_STATS.slotPoints } })).toBe(true);
    expect(sameStats(NO_STATS, { ...NO_STATS, fastestQuickTimeSec: 30 })).toBe(false);
    expect(sameStats(NO_STATS, { ...NO_STATS, slotPoints: { ...NO_STATS.slotPoints, body: 1 } })).toBe(false);
  });
});
