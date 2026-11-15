/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { scoreWeek } from "./lib/scoring";
import { SEED_PHOTOS } from "./lib/seedPhotos";
import { pacificDay, weekEndOf, weekStartOf } from "./lib/week";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Sunday 15 November 2026, 2:30 PM Pacific: the last afternoon of the week.
const NOW = new Date("2026-11-15T22:30:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

type Harness = TestConvex<typeof schema>;

/** Runs the reset and the photo upload it schedules on a deployment without photos. */
async function reset(t: Harness) {
  await t.mutation(api.seed.reset, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function league(t: Harness) {
  return await t.run(async (ctx) => {
    const row = await ctx.db
      .query("leagues")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", "YCHACK"))
      .unique();
    if (row === null) throw new Error("The seeded league is missing");
    return row;
  });
}

async function signedInAs(t: Harness, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

describe("seed.reset", () => {
  test("builds the league: six paid members, an open week, three matchups and a full pot", async () => {
    const t = convexTest(schema, modules);
    await reset(t);

    const { _id: leagueId, name, stakeUsd } = await league(t);
    expect(name).toBe("YC Hackathon");

    const state = await t.run(async (ctx) => {
      const weeks = await ctx.db
        .query("weeks")
        .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
        .collect();
      return {
        weeks,
        memberships: await ctx.db
          .query("memberships")
          .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
          .collect(),
        matchups: await ctx.db
          .query("matchups")
          .withIndex("by_week", (q) => q.eq("weekId", weeks[0]._id))
          .collect(),
        ledger: await ctx.db
          .query("ledger")
          .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
          .collect(),
        lineups: await ctx.db.query("lineups").collect(),
      };
    });

    expect(state.weeks).toHaveLength(1);
    expect(state.weeks[0]).toMatchObject({
      number: 1,
      startsAt: weekStartOf(NOW),
      endsAt: weekEndOf(weekStartOf(NOW)),
      status: "open",
    });
    expect(state.memberships).toHaveLength(6);
    expect(state.memberships.every((membership) => membership.paid)).toBe(true);
    expect(state.matchups).toHaveLength(3);
    expect(new Set(state.matchups.flatMap((matchup) => [matchup.userA, matchup.userB])).size).toBe(6);
    expect(state.ledger.every((row) => row.kind === "buy_in" && row.weekId === state.weeks[0]._id)).toBe(true);
    expect(state.ledger.reduce((sum, row) => sum + row.amountUsd, 0)).toBe(6 * stakeUsd);
    expect(state.lineups).toHaveLength(6);
  });

  test("the seeded week scores to the table the demo expects", async () => {
    const t = convexTest(schema, modules);
    await reset(t);

    const totals = await t.run(async (ctx) => {
      const byName: Record<string, number> = {};
      for (const player of await ctx.db.query("users").collect()) {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_user_week", (q) => q.eq("userId", player._id))
          .collect();
        const proofs = await ctx.db
          .query("proofs")
          .withIndex("by_user_week", (q) => q.eq("userId", player._id))
          .collect();
        const proofDays = proofs.filter((proof) => proof.pass).map((proof) => pacificDay(proof.createdAt));
        byName[player.name ?? ""] = scoreWeek(tasks, proofDays).total;
      }
      return byName;
    });

    expect(totals).toEqual({
      "Maya Chen": 500,
      "Sam Patel": 285,
      "Priya Shah": 195,
      "Jordan Lee": 120,
      "Ava Kim": 60,
      "Leo Martinez": 0,
    });
  });

  test("every proof falls inside the week and before the reset", async () => {
    const t = convexTest(schema, modules);
    await reset(t);

    const proofs = await t.run((ctx) => ctx.db.query("proofs").collect());
    expect(proofs.length).toBeGreaterThan(15);
    for (const proof of proofs) {
      expect(proof.weekStart).toBe(weekStartOf(NOW));
      expect(proof.createdAt).toBeGreaterThanOrEqual(weekStartOf(NOW));
      expect(proof.createdAt).toBeLessThan(NOW);
    }
  });

  test("a failed proof leaves its task open, and the drop task belongs to the closed drop", async () => {
    const t = convexTest(schema, modules);
    await reset(t);

    const { failedTask, dropTask, drop } = await t.run(async (ctx) => {
      const proofs = await ctx.db.query("proofs").collect();
      const failed = proofs.find((proof) => !proof.pass);
      const tasks = await ctx.db.query("tasks").collect();
      const fromDrop = tasks.find((task) => task.source === "drop");
      return {
        failedTask: failed ? await ctx.db.get("tasks", failed.taskId) : null,
        dropTask: fromDrop ?? null,
        drop: fromDrop?.dropId ? await ctx.db.get("drops", fromDrop.dropId) : null,
      };
    });

    expect(failedTask?.status).toBe("open");
    expect(dropTask).toMatchObject({ status: "verified", points: 50 });
    expect(drop).toMatchObject({ kind: "quicktime", status: "closed", points: 40 });
  });

  test("uploads each photo once and attaches one to every proof", async () => {
    const t = convexTest(schema, modules);
    await reset(t);

    const photoCount = Object.keys(SEED_PHOTOS).length;
    const afterFirst = await t.run(async (ctx) => ({
      files: await ctx.db.system.query("_storage").collect(),
      proofs: await ctx.db.query("proofs").collect(),
    }));
    expect(afterFirst.files).toHaveLength(photoCount);
    expect(afterFirst.proofs.every((proof) => proof.storageId !== undefined)).toBe(true);

    // The second reset finds the photos, so it attaches them in the mutation itself.
    await t.mutation(api.seed.reset, {});
    const afterSecond = await t.run(async (ctx) => ({
      files: await ctx.db.system.query("_storage").collect(),
      proofs: await ctx.db.query("proofs").collect(),
    }));
    expect(afterSecond.files).toHaveLength(photoCount);
    expect(afterSecond.proofs.every((proof) => proof.storageId !== undefined)).toBe(true);
  });

  test("keeps the league and player ids and the row counts across resets", async () => {
    const t = convexTest(schema, modules);
    await reset(t);
    const before = await t.run(async (ctx) => ({
      players: await ctx.db.query("users").collect(),
      tasks: (await ctx.db.query("tasks").collect()).length,
      proofs: (await ctx.db.query("proofs").collect()).length,
      reactions: (await ctx.db.query("reactions").collect()).length,
    }));
    const leagueBefore = await league(t);

    await reset(t);
    const after = await t.run(async (ctx) => ({
      players: await ctx.db.query("users").collect(),
      tasks: (await ctx.db.query("tasks").collect()).length,
      proofs: (await ctx.db.query("proofs").collect()).length,
      reactions: (await ctx.db.query("reactions").collect()).length,
    }));

    expect((await league(t))._id).toBe(leagueBefore._id);
    expect(after.players.map((player) => player._id)).toEqual(before.players.map((player) => player._id));
    expect(after).toMatchObject({ tasks: before.tasks, proofs: before.proofs, reactions: before.reactions });
  });

  test("puts a player who joined back out, without touching their own tasks", async () => {
    const t = convexTest(schema, modules);
    await reset(t);
    const { _id: leagueId } = await league(t);
    const { guestId, taskId } = await t.run(async (ctx) => {
      const guestId = await ctx.db.insert("users", { name: "Guest", phone: "+14155550199" });
      await ctx.db.insert("memberships", { leagueId, userId: guestId, paid: false, joinedAt: NOW });
      const taskId = await ctx.db.insert("tasks", {
        userId: guestId,
        weekStart: weekStartOf(NOW),
        slot: "body",
        title: "Swim",
        points: 30,
        proofType: "photo",
        status: "open",
        source: "draft",
      });
      return { guestId, taskId };
    });

    await reset(t);

    const state = await t.run(async (ctx) => ({
      members: await ctx.db
        .query("memberships")
        .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
        .collect(),
      task: await ctx.db.get("tasks", taskId),
    }));
    expect(state.members).toHaveLength(6);
    expect(state.members.some((member) => member.userId === guestId)).toBe(false);
    expect(state.task).not.toBeNull();
  });
});

describe("seed.players and seed.actAs", () => {
  test("players lists the six seeded players in seed order", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.seed.players, {})).toEqual([]);
    await reset(t);
    const players = await t.query(api.seed.players, {});
    expect(players.map((player) => player.name)).toEqual([
      "Maya Chen",
      "Priya Shah",
      "Jordan Lee",
      "Leo Martinez",
      "Ava Kim",
      "Sam Patel",
    ]);
  });

  test("actAs switches the device to a seeded player and back", async () => {
    const t = convexTest(schema, modules);
    await reset(t);
    const [maya] = await t.query(api.seed.players, {});
    const deviceId = await t.run((ctx) => ctx.db.insert("users", { name: "Owner", phone: "+14155550123" }));
    const device = await signedInAs(t, deviceId);

    await device.mutation(api.seed.actAs, { userId: maya._id });
    expect((await device.query(api.users.me, {}))?.actingAs).toEqual({ _id: maya._id, name: "Maya Chen" });

    await device.mutation(api.seed.actAs, { userId: null });
    expect(await device.query(api.users.me, {})).toMatchObject({ _id: deviceId, name: "Owner" });
    expect((await device.query(api.users.me, {}))?.actingAs).toBeUndefined();
  });

  test("actAs refuses a player who isn't seeded, and a signed-out caller", async () => {
    const t = convexTest(schema, modules);
    await reset(t);
    const deviceId = await t.run((ctx) => ctx.db.insert("users", { name: "Owner" }));
    const strangerId = await t.run((ctx) => ctx.db.insert("users", { name: "Stranger" }));
    const device = await signedInAs(t, deviceId);

    await expect(device.mutation(api.seed.actAs, { userId: strangerId })).rejects.toThrow(/seeded player/);
    await expect(t.mutation(api.seed.actAs, { userId: null })).rejects.toThrow(/Not signed in/);
  });
});
