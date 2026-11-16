/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { scoreWeek } from "./lib/scoring";
import { SEED_AVATARS, SEED_PHOTOS } from "./lib/seedPhotos";
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
      const current = weeks[weeks.length - 1];
      return {
        weeks,
        current,
        memberships: await ctx.db
          .query("memberships")
          .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
          .collect(),
        matchups: await ctx.db
          .query("matchups")
          .withIndex("by_week", (q) => q.eq("weekId", current._id))
          .collect(),
        ledger: await ctx.db
          .query("ledger")
          .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
          .collect(),
        lineups: await ctx.db.query("lineups").collect(),
      };
    });

    // Four finished weeks of the season, then the one in play.
    expect(state.weeks.map((week) => week.number)).toEqual([1, 2, 3, 4, 5]);
    expect(state.current).toMatchObject({
      number: 5,
      startsAt: weekStartOf(NOW),
      endsAt: weekEndOf(weekStartOf(NOW)),
      status: "open",
    });
    expect(state.memberships).toHaveLength(6);
    expect(state.memberships.every((membership) => membership.paid)).toBe(true);
    expect(state.matchups).toHaveLength(3);
    expect(new Set(state.matchups.flatMap((matchup) => [matchup.userA, matchup.userB])).size).toBe(6);
    expect(state.ledger.every((row) => row.kind === "buy_in" && row.weekId === state.current._id)).toBe(true);
    expect(state.ledger.reduce((sum, row) => sum + row.amountUsd, 0)).toBe(6 * stakeUsd);
    expect(state.lineups).toHaveLength(6);
  });

  test("the league is in week 5 of an 8-week double round robin", async () => {
    const t = convexTest(schema, modules);
    await reset(t);

    const { _id: leagueId } = await league(t);
    const maya = await t.run(async (ctx) => {
      const players = await ctx.db.query("users").collect();
      return players.find((player) => player.name === "Maya Chen")!;
    });
    const season = await (await signedInAs(t, maya._id)).query(api.seasons.overview, { leagueId });

    expect(season.settings).toEqual({ payout: "weekly", seasonWeeks: 8, format: "double_round_robin" });
    expect(season.currentWeek).toBe(5);
    expect(season.weeks.map((week) => week.status)).toEqual([
      "final", "final", "final", "final", "live", "upcoming", "upcoming", "upcoming",
    ]);
    // The week in play keeps the pairs the players' tasks were written around.
    expect(season.weeks[4].matchups.map((matchup) => [matchup.a.name, matchup.b.name])).toEqual([
      ["Maya Chen", "Sam Patel"],
      ["Priya Shah", "Ava Kim"],
      ["Jordan Lee", "Leo Martinez"],
    ]);
    // Its scores are the standings' own, bonuses included.
    expect(season.weeks[4].matchups[0]).toMatchObject({ scoreA: 500, scoreB: 285, winnerId: null });
    // Everyone has met everyone else once when this week ends.
    const met = season.weeks.slice(0, 5).flatMap((week) =>
      week.matchups.map((matchup) => [matchup.a.name, matchup.b.name].sort().join(" v ")),
    );
    expect(new Set(met).size).toBe(15);
    expect(season.table.map((row) => [row.name, row.wins, row.losses, row.pointsFor])).toEqual([
      ["Sam Patel", 4, 0, 1502],
      ["Maya Chen", 3, 1, 1599],
      ["Priya Shah", 2, 2, 1251],
      ["Jordan Lee", 2, 2, 1162],
      ["Ava Kim", 1, 3, 910],
      ["Leo Martinez", 0, 4, 635],
    ]);
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

  test("uploads each photo and avatar once, and attaches one to every proof and player", async () => {
    const t = convexTest(schema, modules);
    await reset(t);

    const fileCount = Object.keys(SEED_PHOTOS).length + Object.keys(SEED_AVATARS).length;
    const afterFirst = await t.run(async (ctx) => ({
      files: await ctx.db.system.query("_storage").collect(),
      proofs: await ctx.db.query("proofs").collect(),
      players: await ctx.db.query("users").collect(),
    }));
    expect(afterFirst.files).toHaveLength(fileCount);
    expect(afterFirst.proofs.every((proof) => proof.storageId !== undefined)).toBe(true);
    expect(afterFirst.players).toHaveLength(6);
    expect(new Set(afterFirst.players.map((player) => player.avatarStorageId)).size).toBe(6);
    expect(afterFirst.players.every((player) => player.avatarStorageId !== undefined)).toBe(true);

    // The second reset finds the files, so it attaches them in the mutation itself.
    await t.mutation(api.seed.reset, {});
    const afterSecond = await t.run(async (ctx) => ({
      files: await ctx.db.system.query("_storage").collect(),
      proofs: await ctx.db.query("proofs").collect(),
      players: await ctx.db.query("users").collect(),
    }));
    expect(afterSecond.files).toHaveLength(fileCount);
    expect(afterSecond.proofs.every((proof) => proof.storageId !== undefined)).toBe(true);
    expect(afterSecond.players.map((player) => player.avatarStorageId)).toEqual(
      afterFirst.players.map((player) => player.avatarStorageId),
    );
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

  test("keeps Quick Match out of the demo league, with a public league to land in at $20 and $5", async () => {
    const t = convexTest(schema, modules);
    await reset(t);
    const demo = await league(t);
    const guestId = await t.run((ctx) => ctx.db.insert("users", { name: "Guest", phone: "+14155550199" }));
    const guest = await signedInAs(t, guestId);

    const twenty = await guest.mutation(api.leagues.quickMatch, { stakeUsd: 20 });
    const five = await guest.mutation(api.leagues.quickMatch, { stakeUsd: 5 });

    const membersOf = (leagueId: Id<"leagues">) =>
      t.run((ctx) =>
        ctx.db
          .query("memberships")
          .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
          .collect(),
      );
    expect(demo.visibility).toBe("private");
    expect(await membersOf(demo._id)).toHaveLength(6);
    expect(await t.run((ctx) => ctx.db.get("leagues", twenty.leagueId))).toMatchObject({
      name: "Open League",
      stakeUsd: 20,
      visibility: "public",
    });
    expect(await t.run((ctx) => ctx.db.get("leagues", five.leagueId))).toMatchObject({
      name: "Five Dollar League",
      stakeUsd: 5,
      visibility: "public",
    });

    // The seeded players' lineups score there too, so the guest joins a table in play and has
    // somebody to face.
    const table = await guest.query(api.standings.table, { leagueId: twenty.leagueId });
    expect(table.map((row) => [row.name, row.points, row.paid])).toEqual([
      ["Priya Shah", 195, false],
      ["Jordan Lee", 120, false],
      ["Ava Kim", 60, false],
      ["Guest", 0, false],
    ]);
    expect(await guest.query(api.standings.matchup, { leagueId: twenty.leagueId })).not.toBeNull();

    // The invite code still gets a player into the demo league, and a reset asked to rebuild the
    // open leagues empties them of guests like it does the demo league.
    await guest.mutation(api.leagues.joinByCode, { inviteCode: "YCHACK" });
    expect(await membersOf(demo._id)).toHaveLength(7);
    await t.mutation(api.seed.reset, { openLeagues: true });
    expect(await membersOf(demo._id)).toHaveLength(6);
    expect(await membersOf(twenty.leagueId)).toHaveLength(3);
    expect(await membersOf(five.leagueId)).toHaveLength(3);
    const me = await guest.query(api.users.me, {});
    expect(me?.leagues).toEqual([]);
  });

  test("leaves the Quick Match leagues alone, so a player who joined Five Dollar League is still in it", async () => {
    const t = convexTest(schema, modules);
    await reset(t);
    const guestId = await t.run((ctx) => ctx.db.insert("users", { name: "Guest", phone: "+14155550199" }));
    const guest = await signedInAs(t, guestId);
    const { leagueId } = await guest.mutation(api.leagues.quickMatch, { stakeUsd: 5 });
    await guest.mutation(api.leagues.joinByCode, { inviteCode: "YCHACK" });
    const fiveDollarLeague = () =>
      t.run(async (ctx) => {
        const weeks = await ctx.db
          .query("weeks")
          .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
          .collect();
        const weekIds = new Set(weeks.map((week) => week._id));
        return {
          league: await ctx.db.get("leagues", leagueId),
          memberships: await ctx.db
            .query("memberships")
            .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
            .collect(),
          weeks,
          matchups: (await ctx.db.query("matchups").collect()).filter((matchup) => weekIds.has(matchup.weekId)),
        };
      });
    const before = await fiveDollarLeague();
    expect(before.league?.name).toBe("Five Dollar League");
    expect(before.memberships.map((membership) => membership.userId)).toContain(guestId);

    // What the Reset Seed button sends, and `npx convex run seed:reset`.
    await reset(t);

    // Out of the demo league, and everything about the league they quick-matched into is the
    // same rows as before: their membership, the week and who they face.
    expect(await fiveDollarLeague()).toEqual(before);
    const me = await guest.query(api.users.me, {});
    expect(me?.phone).toBe("+14155550199");
    expect(me?.leagues.map((league) => league.name)).toEqual(["Five Dollar League"]);
    expect(await guest.query(api.standings.matchup, { leagueId })).not.toBeNull();
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

  test("clears a challenge opened in the league on a guest's proof, and gives the guest's task back", async () => {
    const t = convexTest(schema, modules);
    await reset(t);
    const { _id: leagueId } = await league(t);
    const [maya] = await t.query(api.seed.players, {});
    const taskId = await t.run(async (ctx) => {
      const guestId = await ctx.db.insert("users", { name: "Guest" });
      const taskId = await ctx.db.insert("tasks", {
        userId: guestId,
        weekStart: weekStartOf(NOW),
        slot: "body",
        title: "Swim",
        points: 30,
        proofType: "photo",
        status: "held",
        source: "draft",
      });
      const proofId = await ctx.db.insert("proofs", {
        taskId,
        userId: guestId,
        weekStart: weekStartOf(NOW),
        mediaType: "photo",
        pass: true,
        confidence: 0.7,
        reason: "A pool lane.",
        highlight: 5,
        caption: "Lengths.",
        via: "app",
        createdAt: NOW - 60_000,
      });
      const challengeId = await ctx.db.insert("challenges", {
        proofId,
        leagueId,
        challengerId: maya._id,
        status: "open",
        closesAt: NOW + 60_000,
      });
      await ctx.db.insert("votes", { challengeId, userId: maya._id, legit: false });
      return taskId;
    });

    await reset(t);

    const state = await t.run(async (ctx) => ({
      challenges: await ctx.db.query("challenges").collect(),
      votes: await ctx.db.query("votes").collect(),
      task: await ctx.db.get("tasks", taskId),
    }));
    expect(state.challenges).toEqual([]);
    expect(state.votes).toEqual([]);
    expect(state.task?.status).toBe("verified");
  });
});

describe("seed.reset leaves nothing behind", () => {
  test("forgets who led, so the first proof after a reset announces no lead change", async () => {
    const t = convexTest(schema, modules);
    await reset(t);
    const { _id: leagueId } = await league(t);
    await t.run(async (ctx) => {
      const guestId = await ctx.db.insert("users", { name: "Guest" });
      await ctx.db.patch("leagues", leagueId, { leaderId: guestId });
    });

    await reset(t);

    expect((await league(t)).leaderId).toBeUndefined();
  });

  test("clears the check-in marks, so the next proof is not measured against the old table", async () => {
    const t = convexTest(schema, modules);
    await reset(t);
    const { _id: leagueId } = await league(t);
    const players = await t.query(api.seed.players, {});
    await t.run(async (ctx) => {
      const guestId = await ctx.db.insert("users", { name: "Guest" });
      await ctx.db.insert("checkinMarks", { leagueId, userId: guestId, points: 310 });
      // Leo had 150 before the reset and has 0 after it.
      await ctx.db.insert("checkinMarks", { leagueId, userId: players[3]._id, points: 150 });
    });

    await reset(t);

    expect(await t.run((ctx) => ctx.db.query("checkinMarks").collect())).toEqual([]);
  });

  test("clears what a seeded player picked up from a switched phone: texts, arrivals and a Canvas connection", async () => {
    const t = convexTest(schema, modules);
    await reset(t);
    const players = await t.query(api.seed.players, {});
    const [maya, , , , , sam] = players;
    await t.run(async (ctx) => {
      const task = await ctx.db
        .query("tasks")
        .withIndex("by_user_week", (q) => q.eq("userId", sam._id))
        .first();
      if (task === null) throw new Error("Sam has no task");
      // Three texts are a player's whole day: left behind, Sam is never texted after the reset.
      for (const kind of ["evening", "rival_passed", "arrival"] as const) {
        await ctx.db.insert("checkinNudges", { userId: sam._id, kind, day: "2026-11-15", text: "Stray.", sentAt: NOW });
      }
      await ctx.db.insert("arrivals", { userId: sam._id, taskId: task._id, lat: 37.76, lng: -122.43, at: NOW });
      await ctx.db.insert("canvasConnections", { userId: sam._id, baseUrl: "https://canvas.example.edu", token: "stray" });
    });

    await reset(t);

    const state = await t.run(async (ctx) => ({
      nudges: await ctx.db.query("checkinNudges").collect(),
      arrivals: await ctx.db.query("arrivals").collect(),
      connections: await ctx.db.query("canvasConnections").collect(),
    }));
    expect(state.nudges).toEqual([]);
    expect(state.arrivals).toEqual([]);
    // Only the demo school the seed connects Maya to.
    expect(state.connections.map((connection) => connection.userId)).toEqual([maya._id]);
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
