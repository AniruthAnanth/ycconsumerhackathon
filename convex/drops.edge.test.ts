// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { askJson } from "./ai";
import { GROUP_CHECK_IN_WINDOW_MS, MYSTERY_WINDOW_MS, QUICK_TIME_WINDOW_MS } from "./lib/dropRules";
import { searchMemories } from "./memory";
import schema from "./schema";

// No test may reach OpenAI or Supermemory: each one says what the model and memory answer.
vi.mock("./ai", async (original) => ({ ...(await original<typeof import("./ai")>()), askJson: vi.fn() }));
vi.mock("./memory", async (original) => ({
  ...(await original<typeof import("./memory")>()),
  searchMemories: vi.fn(),
}));

const modules = import.meta.glob("./**/*.ts");

type Backend = TestConvex<typeof schema>;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const WEEK_START = Date.UTC(2026, 10, 9, 8); // Monday 00:00 in Los Angeles
const NOW = Date.UTC(2026, 10, 15, 20); // the Sunday of that week
const park = { name: "Dolores Park", lat: 37.7596, lng: -122.4269 };

let texts: string[];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  // Keiki is not configured here, and keiki.send then logs the text it would have sent.
  vi.stubEnv("KEIKI_AGENT_ID", "");
  texts = [];
  vi.spyOn(console, "warn").mockImplementation((message: unknown) => void texts.push(String(message)));
  // By default the model is down and memory is empty, which is the path that must still work.
  vi.mocked(askJson).mockRejectedValue(new Error("no model in tests"));
  vi.mocked(searchMemories).mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** A league with one member per name; withWeek: false is a league that has not started its first week. */
async function startLeague(t: Backend, names: string[], options: { withWeek?: boolean } = {}) {
  return await t.run(async (ctx) => {
    const userIds: Id<"users">[] = [];
    for (const name of names) userIds.push(await ctx.db.insert("users", { name }));
    const leagueId = await ctx.db.insert("leagues", {
      name: "YC Hackathon",
      inviteCode: "YCHACK",
      stakeUsd: 5,
      visibility: "private",
      maxMembers: 12,
      createdBy: userIds[0],
    });
    for (const userId of userIds) {
      await ctx.db.insert("memberships", { leagueId, userId, paid: true, joinedAt: NOW });
    }
    if (options.withWeek !== false) {
      await ctx.db.insert("weeks", {
        leagueId,
        number: 1,
        startsAt: WEEK_START,
        endsAt: WEEK_START + 7 * DAY_MS,
        status: "open",
      });
    }
    return { leagueId, userIds };
  });
}

/** A second league in its first week, with these existing players in it. */
async function addLeague(t: Backend, name: string, inviteCode: string, userIds: Id<"users">[]) {
  return await t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name,
      inviteCode,
      stakeUsd: 5,
      visibility: "private",
      maxMembers: 12,
      createdBy: userIds[0],
    });
    for (const userId of userIds) {
      await ctx.db.insert("memberships", { leagueId, userId, paid: true, joinedAt: NOW });
    }
    await ctx.db.insert("weeks", {
      leagueId,
      number: 1,
      startsAt: WEEK_START,
      endsAt: WEEK_START + 7 * DAY_MS,
      status: "open",
    });
    return leagueId;
  });
}

/** Calls the backend as this player: Convex Auth puts the user id first in the token subject. */
function as(t: Backend, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

/** Runs everything the scheduler has due, including what those functions schedule in turn. */
async function runScheduled(t: Backend, afterMs = 1) {
  vi.advanceTimersByTime(afterMs);
  await t.finishInProgressScheduledFunctions();
  for (let hop = 0; hop < 3; hop++) {
    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();
  }
}

/** A task flipped to verified with its passing proof, but without the hook proofs.record schedules. */
async function markVerified(t: Backend, taskId: Id<"tasks">) {
  await t.run(async (ctx) => {
    const task = await ctx.db.get("tasks", taskId);
    if (task === null) throw new Error("no such task");
    await ctx.db.patch("tasks", taskId, { status: "verified" });
    await ctx.db.insert("proofs", {
      taskId,
      userId: task.userId,
      weekStart: task.weekStart,
      storageId: await ctx.storage.store(new Blob(["a photo"], { type: "image/jpeg" })),
      mediaType: "photo",
      pass: true,
      confidence: 0.9,
      reason: "Three fingers up, mid push-up",
      highlight: 6,
      caption: "Dropped and gave twenty",
      via: "keiki",
      createdAt: Date.now(),
    });
  });
}

/** What proofs.record does when a proof passes on a task that has a dropId. */
async function passProof(t: Backend, taskId: Id<"tasks">) {
  await markVerified(t, taskId);
  await t.mutation(internal.drops.onTaskVerified, { taskId });
}

async function tasksOfDrop(t: Backend, dropId: Id<"drops">) {
  return await t.run((ctx) =>
    ctx.db
      .query("tasks")
      .withIndex("by_drop", (q) => q.eq("dropId", dropId))
      .take(50),
  );
}

async function taskOf(t: Backend, dropId: Id<"drops">, userId: Id<"users">) {
  const task = (await tasksOfDrop(t, dropId)).find((candidate) => candidate.userId === userId);
  if (task === undefined) throw new Error("player has no task in this drop");
  return task;
}

async function getDrop(t: Backend, dropId: Id<"drops">) {
  const drop = await t.run((ctx) => ctx.db.get("drops", dropId));
  if (drop === null) throw new Error("no such drop");
  return drop;
}

/** An open quick-time drop worth a fixed number of points, with an open task for each player. */
async function openQuickTime(t: Backend, leagueId: Id<"leagues">, userIds: Id<"users">[], points = 30) {
  return await t.run(async (ctx) => {
    const dropId = await ctx.db.insert("drops", {
      leagueId,
      kind: "quicktime",
      title: "20 push-ups",
      slot: "body",
      points,
      gesture: "a thumbs up",
      sealed: false,
      opensAt: NOW,
      closesAt: NOW + QUICK_TIME_WINDOW_MS,
      status: "open",
    });
    for (const userId of userIds) {
      await ctx.db.insert("tasks", {
        userId,
        weekStart: WEEK_START,
        slot: "body",
        title: "20 push-ups",
        points,
        proofType: "photo",
        status: "open",
        source: "drop",
        dropId,
      });
    }
    return dropId;
  });
}

/** Gives a player points in every league they play: a verified flex task scores exactly its points. */
async function bank(t: Backend, userId: Id<"users">, points: number) {
  await t.run((ctx) =>
    ctx.db.insert("tasks", {
      userId,
      weekStart: WEEK_START,
      slot: "flex",
      title: "Extra mile",
      points,
      proofType: "photo",
      status: "verified",
      source: "flex",
    }),
  );
}

/** The points the league table shows a player, read as viewer. */
async function tablePoints(t: Backend, leagueId: Id<"leagues">, viewer: Id<"users">, userId: Id<"users">) {
  const rows = await as(t, viewer).query(api.standings.table, { leagueId });
  return rows.find((row) => row.userId === userId)?.points;
}

async function envelopesOf(t: Backend) {
  const drops = await t.run((ctx) => ctx.db.query("drops").take(200));
  return drops.filter((drop) => drop.kind === "mystery");
}

/** Runs the morning job and returns the envelope sealed for one player in one league. */
async function envelopeFor(t: Backend, leagueId: Id<"leagues">, userId: Id<"users">) {
  await t.mutation(internal.drops.dailyMystery, {});
  await runScheduled(t);
  const envelope = (await envelopesOf(t)).find((drop) => drop.leagueId === leagueId && drop.userId === userId);
  if (envelope === undefined) throw new Error("no envelope was sealed for this player");
  return envelope;
}

/** Scheduled functions that ended in an error: a failure in a follow-up never reaches the caller. */
async function failedScheduledFunctions(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter((job) => job.state.kind === "failed").map((job) => job.name);
}

async function snapshotOf(t: Backend) {
  return await t.run(async (ctx) => ({
    drops: await ctx.db.query("drops").take(200),
    tasks: await ctx.db.query("tasks").take(200),
    rsvps: await ctx.db.query("rsvps").take(200),
  }));
}

/** A group session two hours from now, called by creator, with the other players RSVP'd. */
async function callSession(t: Backend, leagueId: Id<"leagues">, creator: Id<"users">, going: Id<"users">[] = []) {
  const dropId = await as(t, creator).mutation(api.drops.createGroupSession, {
    leagueId,
    title: "Morning run",
    place: park,
    startsAt: NOW + 2 * HOUR_MS,
  });
  await runScheduled(t);
  for (const userId of going) await as(t, userId).mutation(api.drops.rsvp, { dropId });
  return dropId;
}

/** An attendee checks in with a photo in which the model counts this many people. */
async function checkIn(t: Backend, dropId: Id<"drops">, userId: Id<"users">, peopleInPhoto: number) {
  vi.mocked(askJson).mockResolvedValue({ people: peopleInPhoto });
  await passProof(t, (await taskOf(t, dropId, userId))._id);
  await runScheduled(t);
}

// ─── 1. Authorization ────────────────────────────────────────────────────────────────────────

describe("authorization", () => {
  /** A league with a live quick-time drop, a sealed envelope for Maya and an upcoming group session. */
  async function world() {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const [maya] = userIds;
    const outsider = await t.run((ctx) => ctx.db.insert("users", { name: "Stranger" }));
    await addLeague(t, "Side Quest", "SIDEQ1", [outsider]);
    await as(t, maya).mutation(api.drops.triggerQuickTime, { leagueId });
    const envelope = await envelopeFor(t, leagueId, maya);
    const sessionId = await callSession(t, leagueId, maya);
    return { t, leagueId, maya, outsider, envelope, sessionId };
  }

  type World = Awaited<ReturnType<typeof world>>;

  const publicFunctions: [string, (w: World, caller: ReturnType<typeof as>) => Promise<unknown>][] = [
    ["active", (w, caller) => caller.query(api.drops.active, { leagueId: w.leagueId })],
    ["triggerQuickTime", (w, caller) => caller.mutation(api.drops.triggerQuickTime, { leagueId: w.leagueId })],
    ["acceptMystery", (w, caller) => caller.mutation(api.drops.acceptMystery, { dropId: w.envelope._id, wager: 10 })],
    ["passMystery", (w, caller) => caller.mutation(api.drops.passMystery, { dropId: w.envelope._id })],
    [
      "createGroupSession",
      (w, caller) =>
        caller.mutation(api.drops.createGroupSession, {
          leagueId: w.leagueId,
          title: "Sneaky run",
          place: park,
          startsAt: NOW + 3 * HOUR_MS,
        }),
    ],
    ["rsvp", (w, caller) => caller.mutation(api.drops.rsvp, { dropId: w.sessionId })],
  ];

  it.each(publicFunctions)("refuses a signed-out caller on %s and changes nothing", async (_name, call) => {
    const w = await world();
    const before = await snapshotOf(w.t);

    await expect(call(w, w.t)).rejects.toThrow(/Not signed in/);

    expect(await snapshotOf(w.t)).toEqual(before);
  });

  it.each([
    ["triggerQuickTime", /member of the league/],
    ["acceptMystery", /not yours/],
    ["passMystery", /not yours/],
    ["createGroupSession", /member of the league/],
    ["rsvp", /Join the league/],
  ] as const)("refuses a player outside the league on %s and changes nothing", async (name, message) => {
    const w = await world();
    const call = publicFunctions.find(([candidate]) => candidate === name)?.[1];
    if (call === undefined) throw new Error("unknown function");
    const before = await snapshotOf(w.t);

    await expect(call(w, as(w.t, w.outsider))).rejects.toThrow(message);

    expect(await snapshotOf(w.t)).toEqual(before);
  });

  it("shows a player outside the league nothing from active", async () => {
    const w = await world();

    expect(await as(w.t, w.outsider).query(api.drops.active, { leagueId: w.leagueId })).toEqual([]);
  });
});

// ─── 2. Idempotence ──────────────────────────────────────────────────────────────────────────

describe("idempotence", () => {
  it("pays the first-finisher bonus once however often the verification hook runs", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam", "Leo"]);
    const dropId = await openQuickTime(t, leagueId, userIds, 30);
    const samsTask = await taskOf(t, dropId, userIds[1]);

    await passProof(t, samsTask._id);
    await t.mutation(internal.drops.onTaskVerified, { taskId: samsTask._id });
    await t.mutation(internal.drops.onTaskVerified, { taskId: samsTask._id });
    await runScheduled(t);

    expect((await tasksOfDrop(t, dropId)).map((task) => task.points).sort()).toEqual([30, 30, 40]);
    // 40 for the task, and 5 for the first day of a streak.
    expect(await tablePoints(t, leagueId, userIds[0], userIds[1])).toBe(45);
  });

  it("changes nothing when closeDrop runs again on a quick-time drop, by hand or on schedule", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const dropId = await as(t, userIds[0]).mutation(api.drops.triggerQuickTime, { leagueId });
    await runScheduled(t);
    await passProof(t, (await taskOf(t, dropId, userIds[0]))._id);

    await t.mutation(internal.drops.closeDrop, { dropId });
    const closed = await snapshotOf(t);
    await t.mutation(internal.drops.closeDrop, { dropId });
    await runScheduled(t, QUICK_TIME_WINDOW_MS);

    expect(await snapshotOf(t)).toEqual(closed);
  });

  it("charges an unfinished envelope once when closeDrop runs twice", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    await bank(t, userIds[0], 100);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);
    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id, wager: 30 });

    await t.mutation(internal.drops.closeDrop, { dropId: envelope._id });
    await t.mutation(internal.drops.closeDrop, { dropId: envelope._id });
    await runScheduled(t, MYSTERY_WINDOW_MS);

    expect(await tasksOfDrop(t, envelope._id)).toMatchObject([{ status: "failed", points: -50 }]);
    expect(await tablePoints(t, leagueId, userIds[1], userIds[0])).toBe(50);
  });

  it("sends the group wrap-up once when closeDrop runs twice", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const dropId = await callSession(t, leagueId, userIds[0], [userIds[1]]);
    await runScheduled(t, 2 * HOUR_MS);
    await checkIn(t, dropId, userIds[0], 2);
    await checkIn(t, dropId, userIds[1], 2);

    await t.mutation(internal.drops.closeDrop, { dropId });
    await t.mutation(internal.drops.closeDrop, { dropId });
    await runScheduled(t, GROUP_CHECK_IN_WINDOW_MS);

    expect(texts.filter((text) => text.includes("Morning run is done"))).toHaveLength(1);
  });

  it("creates one task per player and one text when openDrop runs twice", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam", "Leo"]);
    const dropId = await as(t, userIds[0]).mutation(api.drops.triggerQuickTime, { leagueId });

    await t.mutation(internal.drops.openDrop, { dropId });
    await t.mutation(internal.drops.openDrop, { dropId });
    await runScheduled(t);

    expect(await tasksOfDrop(t, dropId)).toHaveLength(3);
    expect(texts.filter((text) => text.includes("Quick-time:"))).toHaveLength(1);
  });

  it("gives each RSVP'd player one check-in task and one reminder when openDrop runs twice", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam", "Leo"]);
    const dropId = await callSession(t, leagueId, userIds[0], [userIds[1]]);

    await t.mutation(internal.drops.openDrop, { dropId });
    await t.mutation(internal.drops.openDrop, { dropId });
    await runScheduled(t);

    expect((await tasksOfDrop(t, dropId)).map((task) => task.userId).sort()).toEqual([userIds[0], userIds[1]].sort());
    expect(texts.filter((text) => text.includes("starts in"))).toHaveLength(2);
  });

  it("keeps one rsvp row and one task per player however often they say IN", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const dropId = await callSession(t, leagueId, userIds[0]);

    await as(t, userIds[0]).mutation(api.drops.rsvp, { dropId });
    await as(t, userIds[1]).mutation(api.drops.rsvp, { dropId });
    await runScheduled(t, 2 * HOUR_MS);
    await as(t, userIds[1]).mutation(api.drops.rsvp, { dropId });
    await t.mutation(internal.drops.rsvpFor, { userId: userIds[1], dropId });

    const rsvps = await t.run((ctx) =>
      ctx.db
        .query("rsvps")
        .withIndex("by_drop", (q) => q.eq("dropId", dropId))
        .take(50),
    );
    expect(rsvps.map((row) => row.userId).sort()).toEqual([userIds[0], userIds[1]].sort());
    expect(await tasksOfDrop(t, dropId)).toHaveLength(2);
  });
});

// ─── 3. Order and races ──────────────────────────────────────────────────────────────────────

describe("order and races", () => {
  it("refuses to open an envelope that was passed", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya"]);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);
    await as(t, userIds[0]).mutation(api.drops.passMystery, { dropId: envelope._id });

    await expect(
      as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id, wager: 10 }),
    ).rejects.toThrow(/already opened, passed or has expired/);

    expect(await tasksOfDrop(t, envelope._id)).toEqual([]);
  });

  it("refuses to pass an envelope that was opened, and keeps its task", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya"]);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);
    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id });

    await expect(as(t, userIds[0]).mutation(api.drops.passMystery, { dropId: envelope._id })).rejects.toThrow(
      /already opened, passed or has expired/,
    );

    expect((await getDrop(t, envelope._id)).status).toBe("open");
    expect(await tasksOfDrop(t, envelope._id)).toMatchObject([{ status: "open" }]);
  });

  it("refuses to open an envelope twice, so it never holds two tasks", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya"]);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);
    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id });

    await expect(
      t.mutation(internal.drops.acceptMysteryFor, { userId: userIds[0], dropId: envelope._id }),
    ).rejects.toThrow(/already opened, passed or has expired/);

    expect(await tasksOfDrop(t, envelope._id)).toHaveLength(1);
  });

  it("refuses to open an envelope once it has closed, by hand or on the clock", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const mine = await envelopeFor(t, leagueId, userIds[0]);
    const theirs = await envelopeFor(t, leagueId, userIds[1]);
    await t.mutation(internal.drops.closeDrop, { dropId: mine._id });
    await runScheduled(t, MYSTERY_WINDOW_MS);

    await expect(as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: mine._id })).rejects.toThrow(
      /already opened, passed or has expired/,
    );
    await expect(as(t, userIds[1]).mutation(api.drops.acceptMystery, { dropId: theirs._id })).rejects.toThrow(
      /already opened, passed or has expired/,
    );

    expect(await tasksOfDrop(t, mine._id)).toEqual([]);
    expect(await tasksOfDrop(t, theirs._id)).toEqual([]);
  });

  it("refuses an rsvp to a session that closed before check-in ever opened", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const dropId = await callSession(t, leagueId, userIds[0]);
    await t.mutation(internal.drops.closeDrop, { dropId });
    await runScheduled(t, 3 * HOUR_MS);

    await expect(as(t, userIds[1]).mutation(api.drops.rsvp, { dropId })).rejects.toThrow(/is over/);
    await expect(t.mutation(internal.drops.rsvpFor, { userId: userIds[1], dropId })).rejects.toThrow(/is over/);

    expect(await tasksOfDrop(t, dropId)).toEqual([]);
    expect((await getDrop(t, dropId)).status).toBe("closed");
  });

  it("refuses an rsvp to a drop that is not a group session", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const dropId = await as(t, userIds[0]).mutation(api.drops.triggerQuickTime, { leagueId });

    await expect(as(t, userIds[1]).mutation(api.drops.rsvp, { dropId })).rejects.toThrow(/doesn't exist/);
  });

  it("refuses a proof for a task whose drop already closed, so no bonus is earned", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const dropId = await openQuickTime(t, leagueId, userIds, 30);
    await t.mutation(internal.drops.closeDrop, { dropId });
    const task = await taskOf(t, dropId, userIds[0]);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["late"], { type: "image/jpeg" })));

    await expect(
      t.mutation(internal.proofs.record, {
        taskId: task._id,
        userId: userIds[0],
        storageId,
        mediaType: "photo",
        via: "keiki",
        verdict: { pass: true, confidence: 0.9, reason: "Thumbs up", highlight: 5, caption: "Late", points: 30, closeCall: false },
      }),
    ).rejects.toThrow(/closed while the referee was looking/);
    await t.mutation(internal.drops.onTaskVerified, { taskId: task._id });
    await runScheduled(t);

    expect(await taskOf(t, dropId, userIds[0])).toMatchObject({ status: "failed", points: 30 });
    expect((await getDrop(t, dropId)).status).toBe("closed");
  });

  it("keeps a bonus earned before the close, and stays closed, when its verification hook arrives late", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const dropId = await openQuickTime(t, leagueId, userIds, 30);
    const mayasTask = await taskOf(t, dropId, userIds[0]);
    await markVerified(t, mayasTask._id);

    await t.mutation(internal.drops.closeDrop, { dropId });
    expect((await taskOf(t, dropId, userIds[0])).points).toBe(40);
    await t.mutation(internal.drops.onTaskVerified, { taskId: mayasTask._id });
    await runScheduled(t);

    expect(await taskOf(t, dropId, userIds[0])).toMatchObject({ status: "verified", points: 40 });
    expect(await taskOf(t, dropId, userIds[1])).toMatchObject({ status: "failed", points: 30 });
    expect((await getDrop(t, dropId)).status).toBe("closed");
  });

  it("replaces a live quick-time drop: unproven tasks fail, proven ones keep their bonus", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const firstId = await as(t, userIds[0]).mutation(api.drops.triggerQuickTime, { leagueId });
    await runScheduled(t);
    await passProof(t, (await taskOf(t, firstId, userIds[0]))._id);
    const first = await getDrop(t, firstId);
    vi.advanceTimersByTime(10 * 60 * 1000);

    const secondId = await as(t, userIds[0]).mutation(api.drops.triggerQuickTime, { leagueId });
    await runScheduled(t);

    expect(await taskOf(t, firstId, userIds[0])).toMatchObject({ status: "verified", points: first.points + 10 });
    expect(await taskOf(t, firstId, userIds[1])).toMatchObject({ status: "failed" });
    expect((await tasksOfDrop(t, secondId)).map((task) => task.status)).toEqual(["open", "open"]);

    // The first drop's own closing time passes: the second drop must not be touched by it.
    await runScheduled(t, QUICK_TIME_WINDOW_MS - 10 * 60 * 1000);
    expect((await getDrop(t, secondId)).status).toBe("open");
    expect((await tasksOfDrop(t, secondId)).map((task) => task.status)).toEqual(["open", "open"]);
  });

  it("leaves one live quick-time drop when the button is pressed twice before the first one opens", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    await as(t, userIds[0]).mutation(api.drops.triggerQuickTime, { leagueId });
    await as(t, userIds[1]).mutation(api.drops.triggerQuickTime, { leagueId });
    await runScheduled(t);

    const banners = await as(t, userIds[0]).query(api.drops.active, { leagueId });
    expect(banners).toHaveLength(1);
  });
});

// ─── 4. Pricing ──────────────────────────────────────────────────────────────────────────────

describe("pricing", () => {
  it("gives the first-finisher bonus to exactly one player when two proofs pass in the same instant", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam", "Leo"]);
    const dropId = await openQuickTime(t, leagueId, userIds, 30);
    const sams = await taskOf(t, dropId, userIds[1]);
    const leos = await taskOf(t, dropId, userIds[2]);
    await markVerified(t, leos._id);
    await markVerified(t, sams._id);

    await t.mutation(internal.drops.onTaskVerified, { taskId: leos._id });
    await t.mutation(internal.drops.onTaskVerified, { taskId: sams._id });
    const settled = (await tasksOfDrop(t, dropId)).filter((task) => task.status === "verified");
    await t.mutation(internal.drops.onTaskVerified, { taskId: sams._id });
    await t.mutation(internal.drops.closeDrop, { dropId });

    expect(settled.map((task) => task.points).sort()).toEqual([30, 40]);
    const final = (await tasksOfDrop(t, dropId)).filter((task) => task.status === "verified");
    expect(final.map((task) => [task._id, task.points])).toEqual(settled.map((task) => [task._id, task.points]));
  });

  it("cuts a wager down to the player's points in this league, not in their other leagues", async () => {
    const t = convexTest(schema, modules);
    const { leagueId: mainId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const sideId = await addLeague(t, "Side Quest", "SIDEQ1", userIds);
    const sideDrop = await openQuickTime(t, sideId, userIds, 30);
    await passProof(t, (await taskOf(t, sideDrop, userIds[0]))._id);
    expect(await tablePoints(t, sideId, userIds[0], userIds[0])).toBeGreaterThan(40);
    expect(await tablePoints(t, mainId, userIds[0], userIds[0])).toBe(0);
    const mainEnvelope = await envelopeFor(t, mainId, userIds[0]);
    const sideEnvelope = await envelopeFor(t, sideId, userIds[0]);

    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: mainEnvelope._id, wager: 40 });
    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: sideEnvelope._id, wager: 40 });

    expect((await getDrop(t, mainEnvelope._id)).wager).toBe(0);
    expect((await getDrop(t, sideEnvelope._id)).wager).toBe(40);
    expect(await taskOf(t, mainEnvelope._id, userIds[0])).toMatchObject({ points: 2 * mainEnvelope.points });
    expect(await taskOf(t, sideEnvelope._id, userIds[0])).toMatchObject({ points: 2 * sideEnvelope.points + 40 });
  });

  it("opens with no wager when the player has no points at all", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);

    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id, wager: 25 });

    expect((await getDrop(t, envelope._id)).wager).toBe(0);
  });

  it("costs 20 when an envelope opened without a wager is not finished", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);
    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id });

    await runScheduled(t, MYSTERY_WINDOW_MS);

    expect(await tasksOfDrop(t, envelope._id)).toMatchObject([{ status: "failed", points: -20 }]);
    expect(await tablePoints(t, leagueId, userIds[1], userIds[0])).toBe(-20);
  });

  it("costs nothing when an envelope is never opened and the day ends", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);

    await runScheduled(t, MYSTERY_WINDOW_MS);

    expect((await getDrop(t, envelope._id)).status).toBe("closed");
    expect(await tasksOfDrop(t, envelope._id)).toEqual([]);
    expect(await tablePoints(t, leagueId, userIds[1], userIds[0])).toBe(0);
  });

  describe("group session points", () => {
    const names = ["Maya", "Sam", "Leo", "Ana", "Raj", "Zoe", "Kai", "Ivy"];

    /** Everyone RSVPs, checkedIn of them check in, and each photo shows peopleInPhoto. */
    async function runSession(checkedIn: number, peopleInPhoto: number) {
      const t = convexTest(schema, modules);
      const { leagueId, userIds } = await startLeague(t, names);
      const dropId = await callSession(t, leagueId, userIds[0], userIds.slice(1));
      await runScheduled(t, 2 * HOUR_MS);
      for (const userId of userIds.slice(0, checkedIn)) await checkIn(t, dropId, userId, peopleInPhoto);
      const present = (await tasksOfDrop(t, dropId)).filter((task) => task.status === "verified");
      return present.map((task) => task.points);
    }

    it.each([
      [1, 30],
      [2, 35],
      [6, 55],
      [8, 55],
    ])("pays %i attendee(s) present %i points each, with the bonus capped at +25", async (attendees, expected) => {
      expect(await runSession(attendees, attendees)).toEqual(Array(attendees).fill(expected));
    });

    it("counts no more attendees than the fullest photo shows, however many checked in", async () => {
      expect(await runSession(6, 4)).toEqual(Array(6).fill(45));
    });

    it("does not count attendees beyond those who checked in when the photo shows more people", async () => {
      expect(await runSession(3, 7)).toEqual(Array(3).fill(40));
    });

    it("pays only the base to everyone while no photo shows more than one person", async () => {
      expect(await runSession(4, 1)).toEqual(Array(4).fill(30));
    });
  });
});

// ─── 5. Scope ────────────────────────────────────────────────────────────────────────────────

describe("scope", () => {
  it("counts a drop task only in its own league for a player who is in two leagues", async () => {
    const t = convexTest(schema, modules);
    const { leagueId: mainId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const sideId = await addLeague(t, "Side Quest", "SIDEQ1", userIds);
    const mainDrop = await openQuickTime(t, mainId, userIds, 30);
    const sideDrop = await openQuickTime(t, sideId, userIds, 20);

    // Each win is its task, the first-finisher 10 and 5 for the first day of a streak.
    await passProof(t, (await taskOf(t, mainDrop, userIds[0]))._id);
    expect(await tablePoints(t, mainId, userIds[1], userIds[0])).toBe(45);
    expect(await tablePoints(t, sideId, userIds[1], userIds[0])).toBe(0);

    await passProof(t, (await taskOf(t, sideDrop, userIds[0]))._id);
    expect(await tablePoints(t, mainId, userIds[1], userIds[0])).toBe(45);
    expect(await tablePoints(t, sideId, userIds[1], userIds[0])).toBe(35);
  });

  it("counts a failed envelope's penalty only in the league it was sealed in", async () => {
    const t = convexTest(schema, modules);
    const { leagueId: mainId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const sideId = await addLeague(t, "Side Quest", "SIDEQ1", userIds);
    const envelope = await envelopeFor(t, mainId, userIds[0]);
    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id });

    await runScheduled(t, MYSTERY_WINDOW_MS);

    expect(await tablePoints(t, mainId, userIds[1], userIds[0])).toBe(-20);
    expect(await tablePoints(t, sideId, userIds[1], userIds[0])).toBe(0);
  });

  it("gives each player only their own taskId on a quick-time banner", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const dropId = await openQuickTime(t, leagueId, userIds, 30);

    const [mine] = await as(t, userIds[0]).query(api.drops.active, { leagueId });
    const [theirs] = await as(t, userIds[1]).query(api.drops.active, { leagueId });

    expect(mine.taskId).toBe((await taskOf(t, dropId, userIds[0]))._id);
    expect(theirs.taskId).toBe((await taskOf(t, dropId, userIds[1]))._id);
    expect(mine.taskId).not.toBe(theirs.taskId);
  });

  it("never shows one player's envelope, its title, wager or task to another", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    await bank(t, userIds[0], 100);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);
    const sealedView = JSON.stringify(await as(t, userIds[1]).query(api.drops.active, { leagueId }));
    expect(sealedView).not.toContain(envelope._id);

    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id, wager: 40 });
    const task = await taskOf(t, envelope._id, userIds[0]);

    const openedView = JSON.stringify(await as(t, userIds[1]).query(api.drops.active, { leagueId }));
    expect(openedView).not.toContain(envelope._id);
    expect(openedView).not.toContain(task._id);
    expect(openedView).not.toContain(envelope.title);
  });

  it("shows the whole league a group session but only the caller's own taskId", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam", "Leo"]);
    const dropId = await callSession(t, leagueId, userIds[0], [userIds[1]]);
    await runScheduled(t, 2 * HOUR_MS);

    const [mine] = await as(t, userIds[0]).query(api.drops.active, { leagueId });
    const [sams] = await as(t, userIds[1]).query(api.drops.active, { leagueId });
    const [leos] = await as(t, userIds[2]).query(api.drops.active, { leagueId });

    expect(mine.taskId).toBe((await taskOf(t, dropId, userIds[0]))._id);
    expect(sams.taskId).toBe((await taskOf(t, dropId, userIds[1]))._id);
    expect(leos.taskId).toBeUndefined();
    expect(JSON.stringify(leos)).not.toContain(String(mine.taskId));
  });
});

// ─── 6. Lead change after a drop ─────────────────────────────────────────────────────────────

describe("lead change after a drop", () => {
  it("texts the league once when the first-finisher bonus is what flips the lead", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    await bank(t, userIds[0], 45);
    await bank(t, userIds[1], 70);
    await t.run((ctx) => ctx.db.patch("leagues", leagueId, { leaderId: userIds[1] }));
    const dropId = await openQuickTime(t, leagueId, userIds, 20);
    const mayasTask = await taskOf(t, dropId, userIds[0]);

    // 45 + 20 is 65, still behind Sam's 70; the +10 and the first streak day's +5 put Maya in front.
    await passProof(t, mayasTask._id);
    await t.mutation(internal.drops.onTaskVerified, { taskId: mayasTask._id });
    await t.mutation(internal.drops.closeDrop, { dropId });
    await runScheduled(t);
    await runScheduled(t, QUICK_TIME_WINDOW_MS);

    const leadTexts = texts.filter((text) => text.includes("took the lead"));
    expect(leadTexts).toHaveLength(1);
    expect(leadTexts[0]).toContain("Maya took the lead in YC Hackathon: 80 points, 10 ahead of Sam.");
    expect(await t.run(async (ctx) => (await ctx.db.get("leagues", leagueId))?.leaderId)).toBe(userIds[0]);
    expect(await failedScheduledFunctions(t)).toEqual([]);
  });

  it("runs the whole quick-time chain without error in a league that has no week row", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"], { withWeek: false });
    const dropId = await as(t, userIds[0]).mutation(api.drops.triggerQuickTime, { leagueId });
    await runScheduled(t);
    await passProof(t, (await taskOf(t, dropId, userIds[0]))._id);
    await runScheduled(t);

    await runScheduled(t, QUICK_TIME_WINDOW_MS);

    expect((await getDrop(t, dropId)).status).toBe("closed");
    expect(await tasksOfDrop(t, dropId)).toHaveLength(2);
    expect(texts.filter((text) => text.includes("took the lead"))).toEqual([]);
    expect(await failedScheduledFunctions(t)).toEqual([]);
  });

  it("runs a group session and a passed envelope without error in a league that has no week row", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"], { withWeek: false });
    const envelope = await envelopeFor(t, leagueId, userIds[0]);
    await as(t, userIds[0]).mutation(api.drops.passMystery, { dropId: envelope._id });
    const sessionId = await callSession(t, leagueId, userIds[0], [userIds[1]]);
    await runScheduled(t, 2 * HOUR_MS);
    await checkIn(t, sessionId, userIds[0], 2);

    await runScheduled(t, GROUP_CHECK_IN_WINDOW_MS);

    expect((await getDrop(t, sessionId)).status).toBe("closed");
    expect(await failedScheduledFunctions(t)).toEqual([]);
  });

  it("opens an envelope in a league that has no week row yet", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya"], { withWeek: false });
    const envelope = await envelopeFor(t, leagueId, userIds[0]);

    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id });

    expect(await tasksOfDrop(t, envelope._id)).toHaveLength(1);
  });
});

// ─── 7. Time ─────────────────────────────────────────────────────────────────────────────────

describe("time", () => {
  it("seals one envelope per member per league, and a second run adds none", async () => {
    const t = convexTest(schema, modules);
    const { leagueId: mainId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const sideId = await addLeague(t, "Side Quest", "SIDEQ1", [userIds[0]]);

    // Two runs before the first one's envelopes have been written, then a third after.
    await t.mutation(internal.drops.dailyMystery, {});
    await t.mutation(internal.drops.dailyMystery, {});
    await runScheduled(t);
    await t.mutation(internal.drops.dailyMystery, {});
    await runScheduled(t);

    const envelopes = await envelopesOf(t);
    expect(envelopes.map((drop) => [drop.leagueId, drop.userId]).sort()).toEqual(
      [
        [mainId, userIds[0]],
        [mainId, userIds[1]],
        [sideId, userIds[0]],
      ].sort(),
    );
    expect(texts.filter((text) => text.includes("Mystery task:"))).toHaveLength(3);
  });

  it("adds no second envelope for a player who already opened theirs that day", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya"]);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);
    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id });

    await t.mutation(internal.drops.dailyMystery, {});
    await runScheduled(t);

    expect(await envelopesOf(t)).toHaveLength(1);
  });

  it("adds no second envelope when the player passed theirs and the job runs again the same day", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya"]);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);
    await as(t, userIds[0]).mutation(api.drops.passMystery, { dropId: envelope._id });

    await t.mutation(internal.drops.dailyMystery, {});
    await runScheduled(t);

    expect(await envelopesOf(t)).toHaveLength(1);
  });

  it("closes an envelope sealed at 16:00 UTC in winter at midnight Pacific, not a moment sooner", async () => {
    vi.setSystemTime(Date.UTC(2026, 10, 15, 16));
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya"]);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);
    const midnightPacific = Date.UTC(2026, 10, 16, 8);

    expect(envelope.closesAt).toBe(envelope.opensAt + MYSTERY_WINDOW_MS);
    expect(Math.abs(envelope.closesAt - midnightPacific)).toBeLessThan(50);

    vi.advanceTimersByTime(envelope.closesAt - Date.now() - 1);
    await t.finishInProgressScheduledFunctions();
    expect((await getDrop(t, envelope._id)).status).toBe("open");

    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();
    expect((await getDrop(t, envelope._id)).status).toBe("closed");
  });

  it("closes an envelope sealed at 16:00 UTC in summer 16 hours later, which is 1 AM Pacific", async () => {
    vi.setSystemTime(Date.UTC(2026, 6, 15, 16));
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya"]);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);

    expect(envelope.closesAt).toBe(envelope.opensAt + MYSTERY_WINDOW_MS);
    expect(Math.abs(envelope.closesAt - Date.UTC(2026, 6, 16, 8))).toBeLessThan(50);

    vi.advanceTimersByTime(envelope.closesAt - Date.now());
    await t.finishInProgressScheduledFunctions();
    expect((await getDrop(t, envelope._id)).status).toBe("closed");
  });
});
