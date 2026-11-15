// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { draftLineup, rateTask, transcribe } from "./ai";
import type { DraftTask } from "./lib/lineupRules";
import { addMemory, searchMemories } from "./memory";
import schema from "./schema";

// No test may reach OpenAI or Supermemory: each one says what the model and memory answer.
vi.mock("./ai", async (original) => ({
  ...(await original<typeof import("./ai")>()),
  draftLineup: vi.fn(),
  rateTask: vi.fn(),
  transcribe: vi.fn(),
}));
vi.mock("./memory", async (original) => ({
  ...(await original<typeof import("./memory")>()),
  addMemory: vi.fn(),
  searchMemories: vi.fn(),
}));

const modules = import.meta.glob("./**/*.ts");

type Backend = TestConvex<typeof schema>;

const WEEK_START = Date.UTC(2026, 10, 9, 8); // Monday, November 9, 00:00 in Los Angeles
const NEXT_WEEK_START = Date.UTC(2026, 10, 16, 8);
const NOW = Date.UTC(2026, 10, 15, 20); // the Sunday of that week, noon in Los Angeles

const task = (slot: DraftTask["slot"], title: string, points = 30): DraftTask => ({
  slot,
  title,
  points,
  proofType: "photo",
});

const FULL_LINEUP = [
  task("body", "Leg day at the gym"),
  task("mind", "Finish OS problem set", 40),
  task("recharge", "Read for 30 minutes", 20),
  task("chores", "Do laundry", 20),
  task("people", "Dinner with Maya", 20),
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(searchMemories).mockResolvedValue([]);
  vi.mocked(addMemory).mockResolvedValue();
  vi.mocked(draftLineup).mockResolvedValue(FULL_LINEUP);
  vi.mocked(rateTask).mockResolvedValue(45);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

/** A fresh backend with one signed-in player. Convex Auth reads the user id from the identity's subject. */
async function signedIn(name = "Sam") {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { name }));
  return { t, userId, as: t.withIdentity({ subject: userId + "|session" }) };
}

async function runScheduled(t: Backend) {
  for (let hop = 0; hop < 3; hop++) {
    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();
  }
}

describe("lineup.draft", () => {
  it("drafts from a typed transcript and searches the player's own memory first", async () => {
    const { as, userId } = await signedIn();
    vi.mocked(searchMemories).mockResolvedValue(["Skipped Body last week", "Skipped Body last week"]);

    const result = await as.action(api.lineup.draft, { transcript: "Gym, problem set, laundry and dinner with Maya" });

    expect(searchMemories).toHaveBeenCalledWith(userId, expect.any(String));
    expect(vi.mocked(draftLineup).mock.calls[0][0]).toMatchObject({
      transcript: "Gym, problem set, laundry and dinner with Maya",
      memories: ["Skipped Body last week"],
      today: "Sunday, November 15",
    });
    expect(transcribe).not.toHaveBeenCalled();
    expect(result.tasks.map((t) => t.slot)).toEqual(["body", "mind", "recharge", "chores", "people"]);
  });

  it("transcribes a recording", async () => {
    const { t, as } = await signedIn();
    vi.mocked(transcribe).mockResolvedValue("Leg day on Tuesday and call my mom");
    const audioStorageId = await t.run((ctx) => ctx.storage.store(new Blob(["aac"], { type: "audio/m4a" })));

    const result = await as.action(api.lineup.draft, { audioStorageId });

    expect(transcribe).toHaveBeenCalledOnce();
    expect(result.transcript).toBe("Leg day on Tuesday and call my mom");
  });

  it("repairs a draft that misses slots or overshoots points", async () => {
    const { as } = await signedIn();
    vi.mocked(draftLineup).mockResolvedValue([task("body", "Run a marathon", 90), task("body", "Evening walk", 4)]);

    const { tasks } = await as.action(api.lineup.draft, { transcript: "I want to run a lot" });

    expect(tasks.map((t) => t.slot)).toEqual(["body", "mind", "recharge", "chores", "people", "flex"]);
    expect(tasks[0]).toMatchObject({ title: "Run a marathon", points: 50 });
    expect(tasks[5]).toMatchObject({ title: "Evening walk", points: 10 });
  });

  it("refuses to draft from silence", async () => {
    const { as } = await signedIn();
    await expect(as.action(api.lineup.draft, { transcript: "um hi" })).rejects.toThrow("Couldn't find a plan");
    expect(draftLineup).not.toHaveBeenCalled();
  });

  it("refuses words with no plan in them instead of inventing a lineup", async () => {
    const { as } = await signedIn();
    // The model returns no tasks when the player named nothing to do.
    vi.mocked(draftLineup).mockResolvedValue([]);
    await expect(as.action(api.lineup.draft, { transcript: "hello how are you" })).rejects.toThrow(
      "Couldn't find a plan in that. Name a few things you want to do this week and try again.",
    );
  });

  it("needs a signed-in player", async () => {
    const t = convexTest(schema, modules);
    await expect(t.action(api.lineup.draft, { transcript: "gym and laundry and reading" })).rejects.toThrow("Not signed in");
  });
});

describe("lineup.lock", () => {
  it("stores the lineup for the current week", async () => {
    const { t, as, userId } = await signedIn();

    const { weekStart } = await as.mutation(api.lineup.lock, { tasks: FULL_LINEUP, transcript: "My week" });
    await runScheduled(t);

    expect(weekStart).toBe(WEEK_START);
    const roster = await as.query(api.lineup.roster, {});
    expect(roster).toMatchObject({ locked: true, weekStart: WEEK_START, total: 0 });
    expect(roster.rows.map((row) => [row.slot, row.title, row.status, row.source])).toEqual(
      FULL_LINEUP.map((t) => [t.slot, t.title, "open", "draft"]),
    );
    const lineups = await t.run((ctx) => ctx.db.query("lineups").collect());
    expect(lineups).toMatchObject([{ userId, weekStart: WEEK_START, transcript: "My week" }]);
  });

  it("targets next week once this week is locked, and never a third time", async () => {
    const { as } = await signedIn();
    await as.mutation(api.lineup.lock, { tasks: FULL_LINEUP });

    expect(await as.mutation(api.lineup.lock, { tasks: FULL_LINEUP })).toEqual({ weekStart: NEXT_WEEK_START });
    await expect(as.mutation(api.lineup.lock, { tasks: FULL_LINEUP })).rejects.toThrow("already locked");

    const nextWeek = await as.query(api.lineup.roster, { weekStart: NEXT_WEEK_START });
    expect(nextWeek.locked).toBe(true);
    expect(nextWeek.rows).toHaveLength(5);
  });

  it("names the slot a lineup is missing", async () => {
    const { as } = await signedIn();
    await expect(as.mutation(api.lineup.lock, { tasks: FULL_LINEUP.slice(1) })).rejects.toThrow(
      "Add a Body task to lock your lineup.",
    );
  });

  it("clamps points and keeps a place only on a check-in task", async () => {
    const { as } = await signedIn();
    const place = { name: "YC office", lat: 37.7609, lng: -122.3862 };
    await as.mutation(api.lineup.lock, {
      tasks: [
        { ...FULL_LINEUP[0], points: 500, place },
        ...FULL_LINEUP.slice(1),
        { slot: "flex", title: "Check in at YC", points: 15, proofType: "photo_location", place },
      ],
    });
    const { rows } = await as.query(api.lineup.roster, {});
    expect(rows[0]).toMatchObject({ points: 50, proofType: "photo" });
    expect(rows[0].place).toBeUndefined();
    expect(rows[5]).toMatchObject({ slot: "flex", proofType: "photo_location", place });
  });
});

describe("lineup.addFlexTask", () => {
  it("adds a task the model then rates", async () => {
    const { t, as } = await signedIn();
    await as.mutation(api.lineup.lock, { tasks: FULL_LINEUP });

    const taskId = await as.mutation(api.lineup.addFlexTask, { title: "  Run a half marathon " });
    await runScheduled(t);

    expect(rateTask).toHaveBeenCalledWith("Run a half marathon");
    const { rows } = await as.query(api.lineup.roster, {});
    expect(rows[5]).toMatchObject({ taskId, slot: "flex", source: "flex", title: "Run a half marathon", points: 45 });
  });

  it("stops at three flex tasks a week", async () => {
    const { as } = await signedIn();
    for (const title of ["One", "Two", "Three"]) await as.mutation(api.lineup.addFlexTask, { title });
    await expect(as.mutation(api.lineup.addFlexTask, { title: "Four" })).rejects.toThrow("already have 3 flex tasks");
  });
});

describe("lineup.roster", () => {
  /** Marks a task verified the way proofs.record does. */
  async function verifyTask(t: Backend, taskId: Id<"tasks">, at: number) {
    await t.run(async (ctx) => {
      const row = await ctx.db.get("tasks", taskId);
      if (row === null) throw new Error("no such task");
      const storageId = await ctx.storage.store(new Blob(["photo"], { type: "image/jpeg" }));
      await ctx.db.patch("tasks", taskId, { status: "verified" });
      await ctx.db.insert("proofs", {
        taskId,
        userId: row.userId,
        weekStart: row.weekStart,
        storageId,
        mediaType: "photo",
        pass: true,
        confidence: 0.9,
        reason: "Looks right.",
        highlight: 5,
        caption: "Done",
        via: "app",
        createdAt: at,
      });
    });
  }

  it("scores verified tasks, shows their photo and points at the next open task", async () => {
    const { t, as } = await signedIn();
    await as.mutation(api.lineup.lock, { tasks: FULL_LINEUP });
    const before = await as.query(api.lineup.roster, {});
    expect(before.rows.map((row) => row.upNext)).toEqual([true, false, false, false, false]);
    expect(before.rows[0]).toMatchObject({ score: null, dueLabel: "Due Sun" });

    await verifyTask(t, before.rows[0].taskId, Date.UTC(2026, 10, 10, 22, 14)); // Tuesday 2:14 PM in Los Angeles

    const after = await as.query(api.lineup.roster, {});
    // The task's 30 points, 25 for clearing its slot and 5 for the first day of a streak.
    expect(after).toMatchObject({ total: 60, bonusPoints: 30, bonusLabels: ["1 slot cleared", "Streak"] });
    expect(after.rows[0]).toMatchObject({ status: "verified", score: 30, dueLabel: "Verified Tue 2:14 PM", upNext: false });
    expect(after.rows[0].thumbUrl).toEqual(expect.any(String));
    expect(after.rows[0].verifiedAt).toBe(Date.UTC(2026, 10, 10, 22, 14));
    expect(after.rows[1].upNext).toBe(true);
  });

  it("adds the week's bonuses, so the total is the player's points in the league table", async () => {
    const { t, as, userId } = await signedIn("Sam");
    await as.mutation(api.lineup.lock, { tasks: FULL_LINEUP });
    const mayaId = await t.run((ctx) => ctx.db.insert("users", { name: "Maya" }));
    const { leagueId, weekId } = await t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", { name: "HOME", inviteCode: "HOME", stakeUsd: 0, visibility: "private", maxMembers: 12, createdBy: userId });
      for (const member of [userId, mayaId]) {
        await ctx.db.insert("memberships", { leagueId, userId: member, paid: true, joinedAt: NOW });
      }
      const weekId = await ctx.db.insert("weeks", { leagueId, number: 1, startsAt: WEEK_START, endsAt: NEXT_WEEK_START, status: "open" });
      await ctx.db.insert("matchups", { weekId, userA: userId, userB: mayaId });
      return { leagueId, weekId };
    });
    const { rows } = await as.query(api.lineup.roster, {});
    await verifyTask(t, rows[0].taskId, Date.UTC(2026, 10, 10, 22)); // Tuesday
    await verifyTask(t, rows[1].taskId, Date.UTC(2026, 10, 11, 22)); // Wednesday
    // Sam challenged a proof and the league agreed with him. Which proof it was doesn't change his points.
    await t.run(async (ctx) => {
      const proof = await ctx.db.query("proofs").first();
      if (proof === null) throw new Error("no proof to challenge");
      await ctx.db.insert("challenges", { proofId: proof._id, leagueId, challengerId: userId, status: "overturned", closesAt: NOW });
    });
    const pointsInTable = async () =>
      (await as.query(api.standings.table, { leagueId })).find((row) => row.userId === userId)?.points;

    // 30 + 40 from the two tasks, then two slots at 25, a two-day streak (5 + 10) and the challenge (10).
    const live = await as.query(api.lineup.roster, { leagueId });
    expect(live).toMatchObject({ total: 145, bonusPoints: 75, bonusLabels: ["2 slots cleared", "Streak", "Challenges"] });
    expect(live.total).toBe(await pointsInTable());

    // A challenge belongs to a league, so a roster read without one leaves it out.
    expect(await as.query(api.lineup.roster, {})).toMatchObject({ total: 135, bonusPoints: 65 });

    // Settling the week pays the head-to-head winner 50.
    await t.run((ctx) => ctx.db.patch("weeks", weekId, { status: "settled" }));
    const settled = await as.query(api.lineup.roster, { leagueId });
    expect(settled).toMatchObject({ total: 195, bonusLabels: ["2 slots cleared", "Streak", "Challenges", "Matchup win"] });
    expect(settled.total).toBe(await pointsInTable());
  });

  it("shows another player's roster when asked", async () => {
    const { t, as, userId } = await signedIn("Sam");
    await as.mutation(api.lineup.lock, { tasks: FULL_LINEUP });
    const mayaId = await t.run((ctx) => ctx.db.insert("users", { name: "Maya" }));
    const asMaya = t.withIdentity({ subject: mayaId + "|session" });
    await t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", { name: "HOME", inviteCode: "HOME", stakeUsd: 0, visibility: "private", maxMembers: 12, createdBy: userId });
      for (const member of [userId, mayaId]) {
        await ctx.db.insert("memberships", { leagueId, userId: member, paid: true, joinedAt: NOW });
      }
    });

    expect((await asMaya.query(api.lineup.roster, {})).rows).toEqual([]);
    expect((await asMaya.query(api.lineup.roster, { userId })).rows).toHaveLength(5);
  });

  it("keeps a roster from a player who shares no league with its owner", async () => {
    const { t, as, userId } = await signedIn("Sam");
    await as.mutation(api.lineup.lock, { tasks: FULL_LINEUP });
    const strangerId = await t.run((ctx) => ctx.db.insert("users", { name: "Zed" }));
    const asStranger = t.withIdentity({ subject: strangerId + "|session" });

    await expect(asStranger.query(api.lineup.roster, { userId })).rejects.toThrow("That player isn't in any of your leagues.");
  });

  it("puts a live drop first in line and keeps it out of other leagues", async () => {
    const { t, as, userId } = await signedIn();
    await as.mutation(api.lineup.lock, { tasks: FULL_LINEUP });
    const { home, away } = await t.run(async (ctx) => {
      const league = (name: string) =>
        ctx.db.insert("leagues", { name, inviteCode: name, stakeUsd: 5, visibility: "private", maxMembers: 12, createdBy: userId });
      const home = await league("HOME");
      const away = await league("AWAY");
      const dropId = await ctx.db.insert("drops", {
        leagueId: home,
        kind: "quicktime",
        title: "20 push-ups",
        slot: "body",
        points: 40,
        gesture: "three fingers up",
        opensAt: NOW,
        closesAt: Date.UTC(2026, 10, 15, 22, 30), // 2:30 PM in Los Angeles
        status: "open",
      });
      await ctx.db.insert("tasks", {
        userId,
        weekStart: WEEK_START,
        slot: "body",
        title: "20 push-ups",
        points: 40,
        proofType: "photo",
        status: "open",
        source: "drop",
        dropId,
      });
      return { home, away };
    });

    const inHome = await as.query(api.lineup.roster, { leagueId: home });
    expect(inHome.rows).toHaveLength(6);
    expect(inHome.rows[5]).toMatchObject({ title: "20 push-ups", source: "drop", upNext: true, dueLabel: "Due 2:30 PM" });
    expect(inHome.rows[0].upNext).toBe(false);

    const inAway = await as.query(api.lineup.roster, { leagueId: away });
    expect(inAway.rows.map((row) => row.source)).toEqual(["draft", "draft", "draft", "draft", "draft"]);
  });

  it("counts the negative points of a stored failed task", async () => {
    const { t, as, userId } = await signedIn();
    await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId,
        weekStart: WEEK_START,
        slot: "body",
        title: "Cold plunge",
        points: -30,
        proofType: "photo",
        status: "failed",
        // "mystery" survives only on tasks stored before the daily mystery task was removed.
        source: "mystery",
      }),
    );
    const roster = await as.query(api.lineup.roster, {});
    expect(roster.total).toBe(-30);
    expect(roster.rows[0]).toMatchObject({ score: -30, dueLabel: "Missed" });
    expect(roster.locked).toBe(false);
  });
});

describe("lineup.rememberOutcomes", () => {
  it("writes each member's finished and unfinished tasks to their own memory", async () => {
    const { t, as, userId } = await signedIn();
    await as.mutation(api.lineup.lock, { tasks: FULL_LINEUP });
    const leagueId = await t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", {
        name: "YC Hackathon",
        inviteCode: "YCHACK",
        stakeUsd: 5,
        visibility: "private",
        maxMembers: 12,
        createdBy: userId,
      });
      await ctx.db.insert("memberships", { leagueId, userId, paid: true, joinedAt: NOW });
      const benchwarmer = await ctx.db.insert("users", { name: "No lineup" });
      await ctx.db.insert("memberships", { leagueId, userId: benchwarmer, paid: true, joinedAt: NOW });
      const [body] = await ctx.db.query("tasks").collect();
      await ctx.db.patch("tasks", body._id, { status: "verified" });
      return leagueId;
    });
    vi.mocked(addMemory).mockClear();

    await t.action(internal.lineup.rememberOutcomes, { leagueId, weekStart: WEEK_START });

    expect(addMemory).toHaveBeenCalledOnce();
    const [namespace, summary] = vi.mocked(addMemory).mock.calls[0];
    expect(namespace).toBe(userId);
    expect(summary).toContain("Result for the week of November 9, 2026: finished 1 of 5 tasks.");
    expect(summary).toContain('Done: body "Leg day at the gym".');
    expect(summary).toContain('Not done: mind "Finish OS problem set"; recharge "Read for 30 minutes"');
  });
});
