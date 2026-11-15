// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { askJson } from "./ai";
import { MYSTERY_FALLBACKS, MYSTERY_WINDOW_MS, QUICK_TIME_WINDOW_MS } from "./lib/dropRules";
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
const WEEK_START = Date.UTC(2026, 10, 9, 8); // Monday 00:00 in Los Angeles
const NOW = Date.UTC(2026, 10, 15, 20); // the Sunday of that week

let texts: string[];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  // keiki.send does not exist in this backend, so every text ends up in the shim's warning.
  texts = [];
  vi.spyOn(console, "warn").mockImplementation((message: unknown) => void texts.push(String(message)));
  // By default the model is down and memory is empty, which is the path that must still work.
  vi.mocked(askJson).mockRejectedValue(new Error("no model in tests"));
  vi.mocked(searchMemories).mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** A league in its first week with one member per name. */
async function startLeague(t: Backend, names: string[]) {
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
    await ctx.db.insert("weeks", {
      leagueId,
      number: 1,
      startsAt: WEEK_START,
      endsAt: WEEK_START + 7 * DAY_MS,
      status: "open",
    });
    return { leagueId, userIds };
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

/** What proofs.verify does when a proof passes on a task that has a dropId. */
async function passProof(t: Backend, taskId: Id<"tasks">) {
  await t.run(async (ctx) => {
    const task = await ctx.db.get("tasks", taskId);
    if (task === null) throw new Error("no such task");
    await ctx.db.patch("tasks", taskId, { status: "verified" });
    await ctx.db.insert("proofs", {
      taskId,
      userId: task.userId,
      weekStart: task.weekStart,
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

async function getDrop(t: Backend, dropId: Id<"drops">) {
  const drop = await t.run((ctx) => ctx.db.get("drops", dropId));
  if (drop === null) throw new Error("no such drop");
  return drop;
}

describe("quick-time drop", () => {
  it("gives every member the task, shows the banner and texts the league", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam", "Leo"]);

    const dropId = await as(t, userIds[0]).mutation(api.drops.triggerQuickTime, { leagueId });
    await runScheduled(t);

    const drop = await getDrop(t, dropId);
    expect(drop).toMatchObject({ kind: "quicktime", status: "open", closesAt: NOW + QUICK_TIME_WINDOW_MS });
    expect(drop.gesture).toBeTruthy();

    const tasks = await tasksOfDrop(t, dropId);
    expect(tasks.map((task) => task.userId).sort()).toEqual([...userIds].sort());
    for (const task of tasks) {
      expect(task).toMatchObject({
        status: "open",
        source: "drop",
        proofType: "photo",
        weekStart: WEEK_START,
        title: drop.title,
        points: drop.points,
      });
    }

    const banners = await as(t, userIds[1]).query(api.drops.active, { leagueId });
    expect(banners).toHaveLength(1);
    expect(banners[0]).toMatchObject({
      dropId,
      kind: "quicktime",
      sealed: false,
      gesture: drop.gesture,
      taskId: tasks.find((task) => task.userId === userIds[1])?._id,
    });

    expect(texts.join("\n")).toContain(`Quick-time: ${drop.title} in the next 2 hours, ${drop.gesture} in the photo.`);
  });

  it("pays the first finisher +10 and everyone after the drop's own points", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam", "Leo"]);
    const dropId = await as(t, userIds[0]).mutation(api.drops.triggerQuickTime, { leagueId });
    await runScheduled(t);
    const drop = await getDrop(t, dropId);
    const taskOf = async (userId: Id<"users">) => {
      const task = (await tasksOfDrop(t, dropId)).find((candidate) => candidate.userId === userId);
      if (task === undefined) throw new Error("member has no drop task");
      return task;
    };

    await passProof(t, (await taskOf(userIds[1]))._id);
    vi.advanceTimersByTime(60_000);
    await passProof(t, (await taskOf(userIds[2]))._id);
    // A repeat of the hook must not pay the bonus again.
    await t.mutation(internal.drops.onTaskVerified, { taskId: (await taskOf(userIds[1]))._id });

    expect((await taskOf(userIds[1])).points).toBe(drop.points + 10);
    expect((await taskOf(userIds[2])).points).toBe(drop.points);

    // Done means no more banner for the finisher; the member still to go keeps theirs.
    expect(await as(t, userIds[1]).query(api.drops.active, { leagueId })).toEqual([]);
    expect(await as(t, userIds[0]).query(api.drops.active, { leagueId })).toHaveLength(1);
  });

  it("closes on time and fails the tasks nobody proved", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const dropId = await as(t, userIds[0]).mutation(api.drops.triggerQuickTime, { leagueId });
    await runScheduled(t);
    const [first] = await tasksOfDrop(t, dropId);
    await passProof(t, first._id);

    await runScheduled(t, QUICK_TIME_WINDOW_MS);

    expect((await getDrop(t, dropId)).status).toBe("closed");
    const statuses = (await tasksOfDrop(t, dropId)).map((task) => task.status).sort();
    expect(statuses).toEqual(["failed", "verified"]);
    expect(await as(t, userIds[0]).query(api.drops.active, { leagueId })).toEqual([]);
    expect(await as(t, userIds[1]).query(api.drops.active, { leagueId })).toEqual([]);
  });

  it("replaces the live drop when triggered again", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const firstId = await as(t, userIds[0]).mutation(api.drops.triggerQuickTime, { leagueId });
    await runScheduled(t);
    const secondId = await as(t, userIds[0]).mutation(api.drops.triggerQuickTime, { leagueId });
    await runScheduled(t);

    expect((await getDrop(t, firstId)).status).toBe("closed");
    const banners = await as(t, userIds[1]).query(api.drops.active, { leagueId });
    expect(banners.map((banner) => banner.dropId)).toEqual([secondId]);
  });

  it("refuses someone who is not in the league", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await startLeague(t, ["Maya"]);
    const outsider = await t.run((ctx) => ctx.db.insert("users", { name: "Stranger" }));

    await expect(as(t, outsider).mutation(api.drops.triggerQuickTime, { leagueId })).rejects.toThrow(/member/);
    expect(await as(t, outsider).query(api.drops.active, { leagueId })).toEqual([]);
  });
});

describe("mystery task", () => {
  /** Runs the morning job and returns the envelope sealed for one player. */
  async function envelopeFor(t: Backend, leagueId: Id<"leagues">, userId: Id<"users">) {
    await t.mutation(internal.drops.dailyMystery, {});
    await runScheduled(t);
    const drops = await t.run((ctx) =>
      ctx.db
        .query("drops")
        .withIndex("by_league_status", (q) => q.eq("leagueId", leagueId).eq("status", "open"))
        .take(50),
    );
    const envelope = drops.find((drop) => drop.kind === "mystery" && drop.userId === userId);
    if (envelope === undefined) throw new Error("no envelope was sealed for this player");
    return envelope;
  }

  /** Banks points for a player: a verified drafted task from this week. */
  async function bank(t: Backend, userId: Id<"users">, points: number) {
    await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId,
        weekStart: WEEK_START,
        slot: "body",
        title: "Leg day",
        points,
        proofType: "photo",
        status: "verified",
        source: "draft",
      }),
    );
  }

  it("seals one envelope per member each morning and hides the task until opened", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);

    const envelope = await envelopeFor(t, leagueId, userIds[0]);
    // A second run the same day hands out nothing new.
    await t.mutation(internal.drops.dailyMystery, {});
    await runScheduled(t);

    const sealed = await t.run((ctx) => ctx.db.query("drops").take(50));
    expect(sealed.map((drop) => drop.userId).sort()).toEqual([...userIds].sort());
    expect(envelope).toMatchObject({ sealed: true, status: "open" });
    expect(envelope.closesAt - envelope.opensAt).toBe(MYSTERY_WINDOW_MS);
    expect(envelope.points).toBeGreaterThanOrEqual(15);
    expect(envelope.points).toBeLessThanOrEqual(30);

    const [banner] = await as(t, userIds[0]).query(api.drops.active, { leagueId });
    expect(banner).toMatchObject({ kind: "mystery", sealed: true, title: "Mystery task", points: 2 * envelope.points });
    expect(banner.taskId).toBeUndefined();
    expect(texts.join("\n")).toMatch(/Mystery task: \w+, 30 to 60 points\. Reply OPEN or PASS\./);
  });

  it("searches the player's memory, then lets the model pick the task", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya"]);
    vi.mocked(searchMemories).mockResolvedValue(["Skipped Body twice last week"]);
    vi.mocked(askJson).mockResolvedValue({ title: "Ten-minute jog", slot: "body", points: 22 });

    const envelope = await envelopeFor(t, leagueId, userIds[0]);

    expect(envelope).toMatchObject({ title: "Ten-minute jog", slot: "body", points: 22 });
    expect(searchMemories).toHaveBeenCalledWith(userIds[0], expect.any(String));
    expect(vi.mocked(askJson).mock.calls[0][0].text).toContain("Skipped Body twice last week");
  });

  it("falls back to the fixed list when the model is unavailable", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya"]);

    const envelope = await envelopeFor(t, leagueId, userIds[0]);

    expect(MYSTERY_FALLBACKS.map((idea) => idea.title)).toContain(envelope.title);
  });

  it("opens into a task worth double, plus the wager", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    await bank(t, userIds[0], 40);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);

    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id, wager: 30 });

    const [task] = await tasksOfDrop(t, envelope._id);
    expect(task).toMatchObject({
      userId: userIds[0],
      status: "open",
      source: "mystery",
      title: envelope.title,
      slot: envelope.slot,
      points: 2 * envelope.points + 30,
    });
    const [banner] = await as(t, userIds[0]).query(api.drops.active, { leagueId });
    expect(banner).toMatchObject({
      sealed: false,
      title: envelope.title,
      wager: 30,
      taskId: task._id,
      points: 2 * envelope.points + 30,
    });
  });

  it("cuts a wager down to 50 and to the points the player has banked", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    await bank(t, userIds[0], 200);
    await bank(t, userIds[1], 20);
    const rich = await envelopeFor(t, leagueId, userIds[0]);
    const poor = await envelopeFor(t, leagueId, userIds[1]);

    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: rich._id, wager: 80 });
    await t.mutation(internal.drops.acceptMysteryFor, { userId: userIds[1], dropId: poor._id, wager: 30 });

    expect((await getDrop(t, rich._id)).wager).toBe(50);
    expect((await getDrop(t, poor._id)).wager).toBe(20);
  });

  it("costs 20 plus the wager when it is opened and not finished in time", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya"]);
    await bank(t, userIds[0], 40);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);
    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id, wager: 30 });

    await runScheduled(t, MYSTERY_WINDOW_MS);

    expect((await getDrop(t, envelope._id)).status).toBe("closed");
    const [task] = await tasksOfDrop(t, envelope._id);
    expect(task).toMatchObject({ status: "failed", points: -50 });
  });

  it("keeps the doubled points when it is finished in time", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya"]);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);
    await as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id });
    const [opened] = await tasksOfDrop(t, envelope._id);

    await passProof(t, opened._id);
    await runScheduled(t, MYSTERY_WINDOW_MS);

    const [task] = await tasksOfDrop(t, envelope._id);
    expect(task).toMatchObject({ status: "verified", points: 2 * envelope.points });
    expect(await as(t, userIds[0]).query(api.drops.active, { leagueId })).toEqual([]);
  });

  it("scores nothing when passed, and cannot be opened afterwards", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya"]);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);

    await as(t, userIds[0]).mutation(api.drops.passMystery, { dropId: envelope._id });

    expect((await getDrop(t, envelope._id)).status).toBe("closed");
    expect(await tasksOfDrop(t, envelope._id)).toEqual([]);
    expect(await as(t, userIds[0]).query(api.drops.active, { leagueId })).toEqual([]);
    await expect(
      as(t, userIds[0]).mutation(api.drops.acceptMystery, { dropId: envelope._id }),
    ).rejects.toThrow(/already opened, passed or has expired/);
  });

  it("belongs to one player: nobody else can open it, pass it or see it", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Maya", "Sam"]);
    const envelope = await envelopeFor(t, leagueId, userIds[0]);

    await expect(
      as(t, userIds[1]).mutation(api.drops.acceptMystery, { dropId: envelope._id }),
    ).rejects.toThrow(/not yours/);
    await expect(
      t.mutation(internal.drops.passMysteryFor, { userId: userIds[1], dropId: envelope._id }),
    ).rejects.toThrow(/not yours/);
    const samsBanners = await as(t, userIds[1]).query(api.drops.active, { leagueId });
    expect(samsBanners.map((banner) => banner.dropId)).not.toContain(envelope._id);
  });
});
