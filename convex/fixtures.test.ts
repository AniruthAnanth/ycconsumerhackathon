// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { isFixtureName } from "./fixtures";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// `remove` schedules its next run; the fake timers let a test decide when that happens.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
});

type Harness = TestConvex<typeof schema>;

/** Runs `remove` and every run it schedules after itself. Returns what the first run deleted. */
async function removeFixtures(
  t: Harness,
  scope: { everything?: boolean; keep?: Id<"users">[]; only?: Id<"users">[] } = {},
): Promise<number> {
  const { deleted } = await t.mutation(internal.fixtures.remove, scope);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return deleted;
}

const WEEK = 0;
const STATS = {
  points: 10,
  slotsCleared: 1,
  streak: 1,
  tasksVerified: 1,
  slotPoints: { body: 10, mind: 0, recharge: 0, chores: 0, people: 0 },
  bestHighlight: 5,
};

const league = (ctx: MutationCtx, name: string, inviteCode: string, createdBy: Id<"users">) =>
  ctx.db.insert("leagues", { name, inviteCode, stakeUsd: 5, visibility: "private", maxMembers: 12, createdBy });

/** A verified task with its proof, and an arrival at it. */
async function provenTask(ctx: MutationCtx, userId: Id<"users">, dropId?: Id<"drops">) {
  const taskId = await ctx.db.insert("tasks", {
    userId,
    weekStart: WEEK,
    slot: "body",
    title: "Run",
    points: 10,
    proofType: "photo",
    status: "verified",
    source: dropId ? "drop" : "draft",
    dropId,
  });
  const proofId = await ctx.db.insert("proofs", {
    taskId,
    userId,
    weekStart: WEEK,
    mediaType: "photo",
    pass: true,
    confidence: 0.9,
    reason: "ok",
    highlight: 5,
    caption: "done",
    via: "app",
    createdAt: 1,
  });
  const arrivalId = await ctx.db.insert("arrivals", { userId, taskId, lat: 0, lng: 0, at: 1 });
  return { taskId, proofId, arrivalId };
}

/** Everything one player can have in one league: a row in every table keyed to the pair. */
async function playIn(ctx: MutationCtx, leagueId: Id<"leagues">, weekId: Id<"weeks">, userId: Id<"users">, rival: Id<"users">) {
  const membershipId = await ctx.db.insert("memberships", { leagueId, userId, paid: true, joinedAt: 0 });
  const matchupId = await ctx.db.insert("matchups", { weekId, userA: userId, userB: rival });
  const ledgerId = await ctx.db.insert("ledger", {
    leagueId,
    weekId,
    userId,
    kind: "buy_in",
    amountUsd: 5,
    idempotencyKey: `seed:${weekId}:${userId}`,
    createdAt: 0,
  });
  const scoreId = await ctx.db.insert("scores", {
    leagueId,
    userId,
    weekStart: WEEK,
    points: 10,
    now: STATS,
    yesterday: STATS,
    day: 0,
    activeDays: [0],
  });
  const markId = await ctx.db.insert("checkinMarks", { leagueId, userId, points: 10 });
  const dropId = await ctx.db.insert("drops", {
    leagueId,
    kind: "group",
    createdBy: userId,
    title: "Park run",
    slot: "flex",
    points: 10,
    opensAt: 0,
    closesAt: 1,
    status: "open",
  });
  const rsvpId = await ctx.db.insert("rsvps", { dropId, userId, checkedIn: true });
  const dropTask = await provenTask(ctx, userId, dropId);
  const linkId = await ctx.db.insert("inviteLinks", {
    token: `${leagueId}:${userId}`,
    inviterId: userId,
    leagueId,
    createdAt: 0,
  });
  const referralId = await ctx.db.insert("referrals", { inviterId: rival, inviteeId: userId, leagueId, joinedAt: 0 });
  return { membershipId, matchupId, ledgerId, scoreId, markId, dropId, rsvpId, linkId, referralId, ...dropTask };
}

/** Everything a player owns outside any league, sign-in included. */
async function ownRows(ctx: MutationCtx, userId: Id<"users">) {
  const lineupId = await ctx.db.insert("lineups", { userId, weekStart: WEEK });
  const nudgeId = await ctx.db.insert("checkinNudges", { userId, kind: "evening", day: "2026-11-15", text: "hi", sentAt: 1 });
  const canvasId = await ctx.db.insert("canvasConnections", { userId, baseUrl: "https://canvas.test", token: "t" });
  const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 1 });
  const tokenId = await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: 1 });
  const accountId = await ctx.db.insert("authAccounts", { userId, provider: "anonymous", providerAccountId: userId });
  const pushId = await ctx.db.insert("pushTokens", { userId, token: `ExponentPushToken[${userId}]`, updatedAt: 0 });
  return { lineupId, nudgeId, canvasId, sessionId, tokenId, accountId, pushId, ...(await provenTask(ctx, userId)) };
}

/**
 * The seeded league with a seeded player, a real device and one fixture player in it, and a
 * fixture league that the fixture player and the real device are both in.
 */
async function world(t: Harness) {
  return await t.run(async (ctx) => {
    const seeded = await ctx.db.insert("users", { name: "Maya Chen", isSeed: true });
    const device = await ctx.db.insert("users", { name: "Demo phone" });
    const fixture = await ctx.db.insert("users", { name: "zz Tester" });

    const seededLeague = await league(ctx, "YC Hackathon", "YCHACK", seeded);
    const seededWeek = await ctx.db.insert("weeks", { leagueId: seededLeague, number: 1, startsAt: WEEK, endsAt: 1, status: "open" });
    const fixtureLeague = await league(ctx, "zz check (safe to delete)", "ZZCHEK", fixture);
    const fixtureWeek = await ctx.db.insert("weeks", { leagueId: fixtureLeague, number: 1, startsAt: WEEK, endsAt: 1, status: "open" });

    const kept = {
      seeded: await ownRows(ctx, seeded),
      device: await ownRows(ctx, device),
      seededInSeeded: await playIn(ctx, seededLeague, seededWeek, seeded, device),
      deviceInSeeded: await playIn(ctx, seededLeague, seededWeek, device, seeded),
    };
    const gone = {
      fixture: await ownRows(ctx, fixture),
      fixtureInSeeded: await playIn(ctx, seededLeague, seededWeek, fixture, seeded),
      fixtureInFixture: await playIn(ctx, fixtureLeague, fixtureWeek, fixture, device),
      deviceInFixture: await playIn(ctx, fixtureLeague, fixtureWeek, device, fixture),
    };

    // What players do to each other's proofs: the fixture player's marks on a proof that stays
    // go, and so does everything on a proof that goes.
    const challengeKept = await ctx.db.insert("challenges", {
      proofId: kept.seeded.proofId,
      leagueId: seededLeague,
      challengerId: device,
      status: "open",
      closesAt: 2,
    });
    const challengeGone = await ctx.db.insert("challenges", {
      proofId: kept.device.proofId,
      leagueId: seededLeague,
      challengerId: fixture,
      status: "open",
      closesAt: 2,
    });
    const social = {
      kept: {
        challengeKept,
        reaction: await ctx.db.insert("reactions", { proofId: kept.seeded.proofId, userId: device, emoji: "fire" }),
        vote: await ctx.db.insert("votes", { challengeId: challengeKept, userId: seeded, legit: true }),
      },
      gone: {
        challengeGone,
        reactionByFixture: await ctx.db.insert("reactions", { proofId: kept.seeded.proofId, userId: fixture, emoji: "fire" }),
        voteByFixture: await ctx.db.insert("votes", { challengeId: challengeKept, userId: fixture, legit: false }),
        voteOnGoneChallenge: await ctx.db.insert("votes", { challengeId: challengeGone, userId: seeded, legit: true }),
        reactionOnGoneProof: await ctx.db.insert("reactions", { proofId: gone.fixture.proofId, userId: device, emoji: "fire" }),
      },
    };

    return {
      device,
      kept: [seeded, device, seededLeague, seededWeek, ...Object.values(kept).flatMap(Object.values), ...Object.values(social.kept)],
      gone: [fixture, fixtureLeague, fixtureWeek, ...Object.values(gone).flatMap(Object.values), ...Object.values(social.gone)],
    };
  });
}

const stillThere = (t: Harness, ids: string[]) =>
  t.run(async (ctx) => {
    const found: string[] = [];
    for (const id of ids) {
      // Ids from any table: the row is looked up by the table its id belongs to.
      for (const table of Object.keys(schema.tables) as TableNames[]) {
        const typed = ctx.db.normalizeId(table, id);
        if (typed !== null && (await ctx.db.get(table, typed)) !== null) found.push(id);
      }
    }
    return found;
  });

describe("isFixtureName", () => {
  test("takes the agreed prefixes and thread codes, and nothing else", () => {
    for (const name of ["zz Whop e2e (safe to delete)", "Whop E2E Maya", "Canvas check 2", "Loop (YCCO-6)"]) {
      expect(isFixtureName(name)).toBe(true);
    }
    for (const name of ["YC Hackathon", "Demo phone", "Maya Chen", "Jazz Club", "zzz", "whop e2e", undefined]) {
      expect(isFixtureName(name)).toBe(false);
    }
  });
});

describe("fixtures.remove", () => {
  test("deletes fixture leagues and players with all that hangs off them, and nothing else", async () => {
    const t = convexTest(schema, modules);
    const { kept, gone } = await world(t);

    await removeFixtures(t);

    expect(await stillThere(t, gone)).toEqual([]);
    expect(await stillThere(t, kept)).toEqual(kept);
  });

  test("lists what it would delete without deleting it", async () => {
    const t = convexTest(schema, modules);
    const { gone } = await world(t);

    expect(await t.query(internal.fixtures.list, {})).toEqual({
      leagues: ["zz check (safe to delete)"],
      players: ["zz Tester"],
    });
    expect(await stillThere(t, gone)).toEqual(gone);
  });

  test("run again, it deletes nothing", async () => {
    const t = convexTest(schema, modules);
    await world(t);
    expect(await removeFixtures(t)).toBeGreaterThan(0);

    expect(await removeFixtures(t)).toBe(0);
    expect(await t.query(internal.fixtures.list, {})).toEqual({ leagues: [], players: [] });
  });

  test("`everything` takes every league and player the seed did not make, except the accounts in `keep`", async () => {
    const t = convexTest(schema, modules);
    const { device, kept, gone } = await world(t);
    // A Quick Match league of the seed's with a tester in it, the demo's versus game, and a
    // tester's own league with a seeded player in it. Neither tester is named as a fixture, and
    // one never gave a name.
    const more = await t.run(async (ctx) => {
      const sam = await ctx.db.insert("users", { name: "Sam Patel", isSeed: true });
      const priya = await ctx.db.insert("users", { name: "Priya Shah", isSeed: true });
      const tester = await ctx.db.insert("users", { name: "Riley Park" });
      const unnamed = await ctx.db.insert("users", {});
      const openLeague = await league(ctx, "Open League", "MATCHA", sam);
      const openWeek = await ctx.db.insert("weeks", { leagueId: openLeague, number: 1, startsAt: WEEK, endsAt: 1, status: "open" });
      const testLeague = await league(ctx, "Riley's league", "RILEY1", tester);
      const testWeek = await ctx.db.insert("weeks", { leagueId: testLeague, number: 1, startsAt: WEEK, endsAt: 1, status: "open" });
      return {
        kept: [
          sam,
          priya,
          openLeague,
          openWeek,
          await league(ctx, "Sam's challenge", "VSMAYA", sam),
          ...Object.values(await playIn(ctx, openLeague, openWeek, sam, priya)),
        ],
        gone: [
          tester,
          unnamed,
          testLeague,
          testWeek,
          ...Object.values(await ownRows(ctx, tester)),
          ...Object.values(await ownRows(ctx, unnamed)),
          ...Object.values(await playIn(ctx, openLeague, openWeek, tester, sam)),
          ...Object.values(await playIn(ctx, testLeague, testWeek, tester, sam)),
          ...Object.values(await playIn(ctx, testLeague, testWeek, sam, tester)),
        ],
      };
    });
    const scope = { everything: true, keep: [device] };

    expect(await t.query(internal.fixtures.list, scope)).toEqual({
      leagues: ["zz check (safe to delete)", "Riley's league"],
      players: ["zz Tester", "Riley Park", "(no name)"],
    });
    await removeFixtures(t, scope);

    expect(await stillThere(t, [...gone, ...more.gone])).toEqual([]);
    expect(await stillThere(t, [...kept, ...more.kept])).toEqual([...kept, ...more.kept]);
    expect(await removeFixtures(t, scope)).toBe(0);
  });

  test("`everything` leaves a league an account in `keep` made or is in, and takes the testers out of it", async () => {
    const t = convexTest(schema, modules);
    const { device, kept, gone } = await world(t);
    // What real phones do on the shared deployment: Quick Match makes one a league of its own,
    // and puts it in a public league that a tester made first. A tester plays in both.
    const more = await t.run(async (ctx) => {
      const friend = await ctx.db.insert("users", { name: "A friend" });
      const tester = await ctx.db.insert("users", { name: "Riley Park" });
      const ownLeague = await league(ctx, "Quick Match Free", "QMFREE", device);
      const ownWeek = await ctx.db.insert("weeks", { leagueId: ownLeague, number: 1, startsAt: WEEK, endsAt: 1, status: "open" });
      const joinedLeague = await league(ctx, "Quick Match $5", "QMFIVE", tester);
      const joinedWeek = await ctx.db.insert("weeks", { leagueId: joinedLeague, number: 1, startsAt: WEEK, endsAt: 1, status: "open" });
      const testLeague = await league(ctx, "Riley's league", "RILEY1", tester);
      return {
        friend,
        kept: [
          friend,
          ownLeague,
          ownWeek,
          joinedLeague,
          joinedWeek,
          ...Object.values(await playIn(ctx, ownLeague, ownWeek, device, friend)),
          ...Object.values(await playIn(ctx, joinedLeague, joinedWeek, device, friend)),
        ],
        gone: [
          tester,
          testLeague,
          ...Object.values(await ownRows(ctx, tester)),
          ...Object.values(await playIn(ctx, ownLeague, ownWeek, tester, device)),
          ...Object.values(await playIn(ctx, joinedLeague, joinedWeek, tester, device)),
        ],
      };
    });
    const scope = { everything: true, keep: [device, more.friend] };

    // The league named as a fixture goes although the real phone is in it.
    expect(await t.query(internal.fixtures.list, scope)).toEqual({
      leagues: ["zz check (safe to delete)", "Riley's league"],
      players: ["zz Tester", "Riley Park"],
    });
    await removeFixtures(t, scope);

    expect(await stillThere(t, [...gone, ...more.gone])).toEqual([]);
    expect(await stillThere(t, [...kept, ...more.kept])).toEqual([...kept, ...more.kept]);
    expect(await removeFixtures(t, scope)).toBe(0);
  });

  test("`only` takes just the named account and the leagues nobody else is in", async () => {
    const t = convexTest(schema, modules);
    const { device, kept } = await world(t);
    const more = await t.run(async (ctx) => {
      const friend = await ctx.db.insert("users", { name: "A friend" });
      const ownLeague = await league(ctx, "Quick Match Free", "QMFREE", device);
      const ownWeek = await ctx.db.insert("weeks", { leagueId: ownLeague, number: 1, startsAt: WEEK, endsAt: 1, status: "open" });
      const emptyLeague = await league(ctx, "Gh", "GHGHGH", device);
      const sharedLeague = await league(ctx, "Quick Match $5", "QMFIVE", friend);
      const sharedWeek = await ctx.db.insert("weeks", { leagueId: sharedLeague, number: 1, startsAt: WEEK, endsAt: 1, status: "open" });
      // The friend's matchup against the named player, and the referral the named player made, go with them.
      const { matchupId, referralId, ...friendInShared } = await playIn(ctx, sharedLeague, sharedWeek, friend, device);
      return {
        kept: [friend, sharedLeague, sharedWeek, ...Object.values(friendInShared)],
        gone: [
          device,
          ownLeague,
          ownWeek,
          emptyLeague,
          matchupId,
          referralId,
          ...Object.values(await ownRows(ctx, device)),
          ...Object.values(await playIn(ctx, ownLeague, ownWeek, device, friend)),
          ...Object.values(await playIn(ctx, sharedLeague, sharedWeek, device, friend)),
        ],
      };
    });
    const scope = { only: [device] };

    expect(await t.query(internal.fixtures.list, scope)).toEqual({
      leagues: ["Quick Match Free", "Gh"],
      players: ["Demo phone"],
    });
    await removeFixtures(t, scope);

    expect(await stillThere(t, more.gone)).toEqual([]);
    // The fixture player and the fixture league are not named, so they stay this time.
    const others = kept.filter((id) => id !== device);
    expect(await stillThere(t, [...more.kept])).toEqual(more.kept);
    expect((await stillThere(t, others)).length).toBeGreaterThan(0);
    expect(await removeFixtures(t, scope)).toBe(0);
  });

  test("`everything` takes an account that is not in `keep`, a real phone's included", async () => {
    const t = convexTest(schema, modules);
    const { device } = await world(t);

    await removeFixtures(t, { everything: true });

    expect(await stillThere(t, [device])).toEqual([]);
  });

  test("never takes the seeded league or a seeded player, whatever they are called", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const seeded = await ctx.db.insert("users", { name: "zz Seeded", isSeed: true });
      return [seeded, await league(ctx, "zz renamed seed league", "YCHACK", seeded)];
    });

    expect(await removeFixtures(t)).toBe(0);
    expect(await stillThere(t, ids)).toEqual(ids);
  });
});
