/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { placeOf, sizeOf, topOf } from "./boardRanks";
import { weekStartOf } from "./lib/week";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type Harness = TestConvex<typeof schema>;

// Sunday 15 November 2026, 2:30 PM Pacific, as in leaderboards.test.ts.
const NOW = new Date("2026-11-15T22:30:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

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

/**
 * The players a tree holds, best first, by name. Level players sit in id order
 * in a tree and in name order on a board, so compare them as places, not lists.
 */
async function treeNames(t: Harness, ...namespace: Parameters<typeof topOf>[1]) {
  return await t.run(async (ctx) => {
    const ids = await topOf(ctx, namespace, 100);
    const rows = await Promise.all(ids.map((id) => ctx.db.get("scores", id)));
    return await Promise.all(rows.map(async (row) => (await ctx.db.get("users", row!.userId))!.name));
  });
}

async function storedRow(t: Harness, leagueId: Id<"leagues">, userId: Id<"users">, weekStart: number) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("scores")
      .withIndex("by_league_week_user", (q) => q.eq("leagueId", leagueId).eq("weekStart", weekStart).eq("userId", userId))
      .unique(),
  );
}

describe("the ranked trees behind the leaderboards", () => {
  test("hold every stored row in board order, and the boards read their order from them", async () => {
    const { t, leagueId, as } = await seededLeague();
    // The all-time tree is the All-Time board's order: Maya 2099, Sam 1787, Priya 1446, ...
    const board = await as("Priya").query(api.leaderboards.board, { leagueId, board: "allTime" });
    expect(await treeNames(t, "points", leagueId, 0)).toEqual(board.rows.map((row) => row.name));
    expect(board.rows.map((row) => row.value)).toEqual([2099, 1787, 1446, 1282, 970, 635]);
    // Every row's place in the tree is its place on the board.
    for (const row of board.rows) {
      const stored = (await storedRow(t, leagueId, row.userId, 0))!;
      expect(await t.run((ctx) => placeOf(ctx, stored, "points", leagueId))).toBe(row.rank - 1);
    }
    // One entry per member: the size of a board is a single count.
    expect(await t.run((ctx) => sizeOf(ctx, ["points", leagueId, 0]))).toBe(6);
    // The global week tree has a row per member of every league, in points order.
    const global = await as("Priya").query(api.leaderboards.board, { leagueId, board: "global" });
    expect(new Set(await treeNames(t, "points", "global", weekStartOf(NOW)))).toEqual(new Set(global.rows.map((row) => row.name)));
  });

  test("move a player the moment a score change is stored, in every tree it touches", async () => {
    const { t, leagueId, as, idOf } = await seededLeague();
    const leo = idOf("Leo");
    const placeIn = async (metric: "points" | "body", scope: Id<"leagues"> | "global", weekStart: number) => {
      const row = (await storedRow(t, leagueId, leo, weekStart)) as Doc<"scores">;
      return await t.run((ctx) => placeOf(ctx, row, metric, scope));
    };
    expect(await placeIn("body", leagueId, 0)).toBe(5);
    expect(await placeIn("points", "global", weekStartOf(NOW))).toBe(5);

    // Leo proves his Body task through the app's own path; the scheduled refresh stores it.
    const { taskId, storageId } = await t.run(async (ctx) => {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_user_week", (q) => q.eq("userId", leo).eq("weekStart", weekStartOf(NOW)))
        .collect();
      return { taskId: tasks.find((task) => task.slot === "body")!._id, storageId: await ctx.storage.store(new Blob(["a photo"])) };
    });
    await t.mutation(internal.proofs.record, {
      taskId,
      userId: leo,
      storageId,
      mediaType: "photo",
      via: "app",
      verdict: { pass: true, confidence: 0.9, reason: "A long ride.", highlight: 7, caption: "Done.", points: 90, closeCall: false },
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    // The tree puts him among the players level with him on the board: after
    // everyone ranked ahead (rank - 1), before everyone ranked behind.
    const within = (rows: { rank: number; isMe: boolean }[], place: number | null) => {
      const me = rows.find((row) => row.isMe)!;
      const level = rows.filter((row) => row.rank === me.rank).length;
      expect(place).toBeGreaterThanOrEqual(me.rank - 1);
      expect(place).toBeLessThan(me.rank - 1 + level);
      return me;
    };
    const body = await as("Leo").query(api.leaderboards.board, { leagueId, board: "body" });
    const onBody = within(body.rows, await placeIn("body", leagueId, 0));
    expect(onBody.rank).toBeLessThan(6);
    // The global tree holds a row per league, and the proof opened a second one for some
    // players (a challenge's league). The board keeps each player's best row: the first met.
    const global = await as("Leo").query(api.leaderboards.board, { leagueId, board: "global" });
    const firstMet = [...new Set(await treeNames(t, "points", "global", weekStartOf(NOW)))];
    expect(firstMet).toEqual(global.rows.map((row) => row.name));
    expect(global.rows.find((row) => row.isMe)!.value).toBeGreaterThan(0);
  });

  test("lose a row's entries when the row is removed", async () => {
    const { t, leagueId, idOf } = await seededLeague();
    await t.run(async (ctx) => {
      const ava = await ctx.db
        .query("memberships")
        .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", idOf("Ava")))
        .unique();
      await ctx.db.delete("memberships", ava!._id);
    });
    await t.mutation(internal.leaderboards.rebuild, { leagueId });
    expect(await treeNames(t, "points", leagueId, 0)).not.toContain("Ava Kim");
    expect(await t.run((ctx) => sizeOf(ctx, ["points", leagueId, 0]))).toBe(5);
    expect(await t.run((ctx) => sizeOf(ctx, ["points", "global", weekStartOf(NOW)]))).toBe(5);
  });

  test("backfill adds rows stored before the trees existed, and running it twice adds nothing", async () => {
    const { t, leagueId, idOf } = await seededLeague();
    // A row written straight to the table, as every row was before this module.
    const old = (await storedRow(t, leagueId, idOf("Maya"), 0))!;
    const { _id, _creationTime, ...row } = old;
    const otherLeague = await t.run(async (ctx) =>
      ctx.db.insert("leagues", { name: "Older league", inviteCode: "OLDER1", stakeUsd: 0, visibility: "private", maxMembers: 12, createdBy: idOf("Maya") }),
    );
    await t.run((ctx) => ctx.db.insert("scores", { ...row, leagueId: otherLeague }));
    expect(await t.run((ctx) => sizeOf(ctx, ["points", otherLeague, 0]))).toBe(0);

    await t.mutation(internal.boardRanks.backfill, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.mutation(internal.boardRanks.backfill, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await treeNames(t, "points", otherLeague, 0)).toEqual(["Maya Chen"]);
    expect(await t.run((ctx) => sizeOf(ctx, ["points", leagueId, 0]))).toBe(6);
    expect(await t.run((ctx) => sizeOf(ctx, ["points", "global", 0]))).toBe(7);
  });
});
