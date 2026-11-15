// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type Backend = TestConvex<typeof schema>;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_START = Date.UTC(2026, 10, 9, 8); // Monday 00:00 in Los Angeles
const NOON = Date.UTC(2026, 10, 15, 20); // Sunday 12:00 PM in Los Angeles: the last day
const GYM = { name: "Fitness SF", lat: 37.7609, lng: -122.3884 };
const AT_THE_GYM = { lat: 37.761, lng: -122.3884 }; // about 11 m from the pin
const DOWN_THE_STREET = { lat: 37.7618, lng: -122.3884 }; // about 100 m

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOON);
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * "YC Hackathon", $20 a head. Its week starts at weekStart, which by default makes NOON the last
 * day. Every player has opted in to texts.
 */
async function startLeague(t: Backend, names: string[], weekStart = WEEK_START) {
  return await t.run(async (ctx) => {
    const userIds: Id<"users">[] = [];
    for (const name of names) userIds.push(await ctx.db.insert("users", { name, keikiOptIn: true }));
    const leagueId = await ctx.db.insert("leagues", {
      name: "YC Hackathon",
      inviteCode: "YCHACK",
      stakeUsd: 20,
      visibility: "private",
      maxMembers: 12,
      createdBy: userIds[0],
    });
    for (const userId of userIds) {
      await ctx.db.insert("memberships", { leagueId, userId, paid: true, joinedAt: WEEK_START });
    }
    const weekId = await ctx.db.insert("weeks", {
      leagueId,
      number: 1,
      startsAt: weekStart,
      endsAt: weekStart + 7 * DAY_MS,
      status: "open",
    });
    return { leagueId, weekId, userIds };
  });
}

type TaskFields = Partial<Omit<Doc<"tasks">, "_id" | "_creationTime" | "userId">>;

async function addTask(t: Backend, userId: Id<"users">, fields: TaskFields = {}): Promise<Id<"tasks">> {
  return await t.run((ctx) =>
    ctx.db.insert("tasks", {
      userId,
      weekStart: WEEK_START,
      slot: "body",
      title: "Leg day",
      points: 40,
      proofType: "photo",
      status: "open",
      source: "draft",
      ...fields,
    }),
  );
}

/** Calls the backend as this player: Convex Auth puts the user id first in the token subject. */
function as(t: Backend, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function textsTo(t: Backend, userId: Id<"users">): Promise<string[]> {
  const rows = await t.run((ctx) =>
    ctx.db
      .query("checkinNudges")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .collect(),
  );
  return rows.map((row) => row.text);
}

/** Turns the player's texts off and gives them a phone that can be pushed. */
async function pushInsteadOfText(t: Backend, userId: Id<"users">) {
  await t.run(async (ctx) => {
    await ctx.db.patch("users", userId, { keikiOptIn: undefined });
    await ctx.db.insert("pushTokens", { userId, token: `ExponentPushToken[${userId}]`, updatedAt: NOON });
  });
}

/** The arguments of every call the backend has scheduled to this function. */
async function scheduledTo(t: Backend, name: "keiki:send" | "push:send" | "checkins:nudge") {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter((job) => job.name === name).map((job) => job.args[0]);
}

describe("checkins.prompt", () => {
  it("names the rival and the gap as the League tab scores them, on the task most at risk", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Me", "Maya Chen"]);
    const [me, maya] = userIds;
    const legDay = await addTask(t, me);
    await addTask(t, me, { slot: "flex", title: "Sunset walk", points: 50 });
    await addTask(t, maya, { slot: "mind", title: "Problem set", points: 15, status: "verified" });

    // Maya has 15 for the task and 25 for clearing Mind. Leg day would bring 40 + 25 + a streak day.
    expect(await as(t, me).query(api.checkins.prompt, { leagueId, now: NOON })).toEqual({
      kind: "at_risk",
      taskId: legDay,
      label: "12H LEFT",
      line: "Maya's up 40. Leg day flips it.",
      task: { title: "Leg day", points: 40, proofType: "photo" },
    });
  });

  it("measures the gap against this week's head-to-head opponent when there is one", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, weekId, userIds } = await startLeague(t, ["Me", "Maya", "Sam"]);
    const [me, maya, sam] = userIds;
    await addTask(t, me);
    await addTask(t, maya, { points: 15, status: "verified" });
    await addTask(t, sam, { points: 90, status: "verified" });
    await t.run((ctx) => ctx.db.insert("matchups", { weekId, userA: sam, userB: me }));

    const prompt = await as(t, me).query(api.checkins.prompt, { leagueId, now: NOON });
    // Sam: 90 + 25 for the slot. Leg day is worth 70 with its slot and streak bonuses.
    expect(prompt?.line).toBe("Sam's up 115. Leg day.");
  });

  it("leaves a live quick-time drop to Roster's own banner and asks for the next check-in", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    await addTask(t, me);
    const dropId = await t.run((ctx) =>
      ctx.db.insert("drops", {
        leagueId,
        kind: "quicktime",
        title: "20 push-ups",
        slot: "body",
        points: 40,
        gesture: "three fingers up",
        sealed: false,
        opensAt: NOON - 73 * MINUTE_MS,
        closesAt: NOON + 47 * MINUTE_MS,
        status: "open",
      }),
    );
    await addTask(t, me, { title: "20 push-ups", source: "drop", dropId });

    const prompt = await as(t, me).query(api.checkins.prompt, { leagueId, now: NOON });
    expect(prompt).toMatchObject({ kind: "at_risk", label: "12H LEFT", task: { title: "Leg day" } });
  });

  it("asks for the check-in when the player arrives at a pinned place, but not from down the street", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    await addTask(t, me, { slot: "mind", title: "Problem set", points: 45 });
    const gym = await addTask(t, me, { proofType: "photo_location", place: GYM });

    expect(await as(t, me).query(api.checkins.prompt, { leagueId, now: NOON, ...AT_THE_GYM })).toEqual({
      kind: "nearby",
      taskId: gym,
      label: "HERE",
      line: "You're at Fitness SF. Check in?",
      task: { title: "Leg day", points: 40, proofType: "photo_location", place: GYM },
    });
    const away = await as(t, me).query(api.checkins.prompt, { leagueId, now: NOON, ...DOWN_THE_STREET });
    expect(away?.kind).toBe("at_risk");
  });

  it("asks for an unpinned Body task when the phone says it is at a gym, and not anywhere else", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    await addTask(t, me, { slot: "mind", title: "Problem set", points: 45 });
    const legDay = await addTask(t, me);

    expect(
      await as(t, me).query(api.checkins.prompt, { leagueId, now: NOON, ...DOWN_THE_STREET, placeName: "Fitness SF" }),
    ).toEqual({
      kind: "nearby",
      taskId: legDay,
      label: "HERE",
      line: "You're at Fitness SF. Check in?",
      task: { title: "Leg day", points: 40, proofType: "photo" },
    });
    const elsewhere = await as(t, me).query(api.checkins.prompt, { leagueId, now: NOON, placeName: "2450 Mission St" });
    expect(elsewhere?.kind).toBe("at_risk");
  });

  it("leaves another league's drop task off this league's prompt", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    const other = await startLeague(t, ["Someone else"]);
    const dropId = await t.run((ctx) =>
      ctx.db.insert("drops", {
        leagueId: other.leagueId,
        kind: "quicktime",
        title: "20 push-ups",
        slot: "body",
        points: 40,
        sealed: false,
        opensAt: NOON,
        closesAt: NOON + HOUR_MS,
        status: "open",
      }),
    );
    await addTask(t, me, { title: "20 push-ups", source: "drop", dropId });

    expect(await as(t, me).query(api.checkins.prompt, { leagueId, now: NOON })).toBeNull();
  });

  it("asks for nothing once the week is settled, or of someone outside the league", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, weekId, userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    await addTask(t, me);
    const stranger = await t.run((ctx) => ctx.db.insert("users", { name: "Stranger" }));
    await addTask(t, stranger);
    expect(await as(t, stranger).query(api.checkins.prompt, { leagueId, now: NOON })).toBeNull();

    await t.run((ctx) => ctx.db.patch("weeks", weekId, { status: "settled" }));
    expect(await as(t, me).query(api.checkins.prompt, { leagueId, now: NOON })).toBeNull();
  });
});

describe("checkins.recordArrival", () => {
  it("keeps the arrival for an hour as the location of a texted photo", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    const gym = await addTask(t, me, { proofType: "photo_location", place: GYM });

    await as(t, me).mutation(api.checkins.recordArrival, { taskId: gym, ...AT_THE_GYM });
    expect(await t.query(internal.checkins.recentArrival, { userId: me, taskId: gym })).toMatchObject(AT_THE_GYM);

    vi.setSystemTime(NOON + 61 * MINUTE_MS);
    expect(await t.query(internal.checkins.recentArrival, { userId: me, taskId: gym })).toBeNull();
  });

  it("texts a player who plays by text once per task per day, however often the app reports it", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    const gym = await addTask(t, me, { proofType: "photo_location", place: GYM });

    await as(t, me).mutation(api.checkins.recordArrival, { taskId: gym, ...AT_THE_GYM });
    vi.setSystemTime(NOON + MINUTE_MS);
    await as(t, me).mutation(api.checkins.recordArrival, { taskId: gym, ...AT_THE_GYM });

    expect(await textsTo(t, me)).toEqual(["You're at Fitness SF. Reply with a photo to check in."]);
    // The second report still moved the arrival forward.
    const arrival = await t.query(internal.checkins.recentArrival, { userId: me, taskId: gym });
    expect(arrival?.at).toBeGreaterThanOrEqual(NOON + MINUTE_MS);
  });

  it("records the arrival but sends no text to a player who has not opted in", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    await t.run((ctx) => ctx.db.patch("users", me, { keikiOptIn: undefined }));
    const gym = await addTask(t, me, { proofType: "photo_location", place: GYM });

    await as(t, me).mutation(api.checkins.recordArrival, { taskId: gym, ...AT_THE_GYM });
    expect(await textsTo(t, me)).toEqual([]);
    expect(await t.query(internal.checkins.recentArrival, { userId: me, taskId: gym })).not.toBeNull();
  });

  it("ignores a report from too far away or for somebody else's task", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me", "Maya"]);
    const [me, maya] = userIds;
    const gym = await addTask(t, me, { proofType: "photo_location", place: GYM });

    await as(t, me).mutation(api.checkins.recordArrival, { taskId: gym, ...DOWN_THE_STREET });
    await as(t, maya).mutation(api.checkins.recordArrival, { taskId: gym, ...AT_THE_GYM });
    expect(await t.query(internal.checkins.recentArrival, { userId: me, taskId: gym })).toBeNull();
    expect(await t.query(internal.checkins.recentArrival, { userId: maya, taskId: gym })).toBeNull();
  });
});

describe("checkins.recordArrival at a gym", () => {
  it("accepts an unpinned Body task only when the phone names a gym, and texts that place once", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    const legDay = await addTask(t, me);

    await as(t, me).mutation(api.checkins.recordArrival, { taskId: legDay, ...AT_THE_GYM, placeName: "2450 Mission St" });
    await as(t, me).mutation(api.checkins.recordArrival, { taskId: legDay, ...AT_THE_GYM });
    expect(await t.query(internal.checkins.recentArrival, { userId: me, taskId: legDay })).toBeNull();
    expect(await textsTo(t, me)).toEqual([]);

    await as(t, me).mutation(api.checkins.recordArrival, { taskId: legDay, ...AT_THE_GYM, placeName: "Fitness SF" });
    vi.setSystemTime(NOON + MINUTE_MS);
    await as(t, me).mutation(api.checkins.recordArrival, { taskId: legDay, ...AT_THE_GYM, placeName: "Fitness SF" });
    expect(await t.query(internal.checkins.recentArrival, { userId: me, taskId: legDay })).toMatchObject(AT_THE_GYM);
    expect(await textsTo(t, me)).toEqual(["You're at Fitness SF. Reply with a photo to check in."]);
  });

  it("leaves a pinned task to the 30 m check, and an unpinned task outside Body alone", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    const pinned = await addTask(t, me, { proofType: "photo_location", place: GYM });
    const reading = await addTask(t, me, { slot: "mind", title: "Problem set" });

    await as(t, me).mutation(api.checkins.recordArrival, { taskId: pinned, ...DOWN_THE_STREET, placeName: "Fitness SF" });
    await as(t, me).mutation(api.checkins.recordArrival, { taskId: reading, ...AT_THE_GYM, placeName: "Fitness SF" });
    expect(await t.query(internal.checkins.recentArrival, { userId: me, taskId: pinned })).toBeNull();
    expect(await t.query(internal.checkins.recentArrival, { userId: me, taskId: reading })).toBeNull();

    await as(t, me).mutation(api.checkins.recordArrival, { taskId: pinned, ...AT_THE_GYM, placeName: "Somewhere Else" });
    expect(await textsTo(t, me)).toEqual(["You're at Fitness SF. Reply with a photo to check in."]);
  });

  it("ignores an open task left over from a week that has ended", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    const lastWeek = await addTask(t, me, { weekStart: WEEK_START - 7 * DAY_MS, proofType: "photo_location", place: GYM });

    await as(t, me).mutation(api.checkins.recordArrival, { taskId: lastWeek, ...AT_THE_GYM });
    expect(await textsTo(t, me)).toEqual([]);
    expect(await t.query(internal.checkins.recentArrival, { userId: me, taskId: lastWeek })).toBeNull();
  });

  it("ignores a quick-time drop's task once the drop has closed, even before its closing job runs", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    const dropId = await t.run((ctx) =>
      ctx.db.insert("drops", {
        leagueId,
        kind: "quicktime",
        title: "Leg day",
        slot: "body",
        points: 40,
        sealed: false,
        opensAt: NOON - 2 * HOUR_MS,
        closesAt: NOON - HOUR_MS,
        status: "open",
      }),
    );
    const drop = await addTask(t, me, { source: "drop", dropId, proofType: "photo_location", place: GYM });

    await as(t, me).mutation(api.checkins.recordArrival, { taskId: drop, ...AT_THE_GYM });
    expect(await textsTo(t, me)).toEqual([]);
    expect(await t.query(internal.checkins.recentArrival, { userId: me, taskId: drop })).toBeNull();
  });
});

describe("checkins.nudge", () => {
  it("sends the last-day text with the open slots, the stake and the rival, once", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me", "Maya"]);
    const [me, maya] = userIds;
    await addTask(t, me);
    await addTask(t, me, { slot: "chores", title: "Laundry", points: 20 });
    await addTask(t, me, { slot: "mind", title: "Problem set", points: 30, status: "verified" });
    await addTask(t, maya, { points: 45, status: "verified" });

    const text = "Last day. Body and Chores are still open. $20 is on the line. Maya's up 15.";
    expect(await t.mutation(internal.checkins.nudge, { userId: me })).toBe(text);
    expect(await t.mutation(internal.checkins.nudge, { userId: me })).toBeNull();
    expect(await textsTo(t, me)).toEqual([text]);
  });

  it("sends the evening text when nothing was proven today, and not after a proof", async () => {
    const t = convexTest(schema, modules);
    // The following week, on its Wednesday at 6 PM: a day that is not the last one.
    const weekStart = WEEK_START + 7 * DAY_MS;
    const wednesdayEvening = weekStart + 2 * DAY_MS + 18 * HOUR_MS;
    vi.setSystemTime(wednesdayEvening);
    const { userIds } = await startLeague(t, ["Me", "Maya"], weekStart);
    const [me, maya] = userIds;
    await addTask(t, me, { weekStart });
    const run = await addTask(t, maya, { weekStart, title: "5k run" });
    await addTask(t, maya, { weekStart, slot: "chores", title: "Laundry", points: 20 });

    expect(await t.mutation(internal.checkins.nudge, { userId: me })).toBe(
      "Leg day isn't on the board yet. Tied with Maya. Reply with a photo.",
    );

    // Maya proved her run an hour ago. She still has laundry open, but her day is not empty.
    await t.run(async (ctx) => {
      await ctx.db.patch("tasks", run, { status: "verified" });
      await ctx.db.insert("proofs", {
        taskId: run,
        userId: maya,
        weekStart,
        mediaType: "photo",
        pass: true,
        confidence: 0.9,
        reason: "Running shoes and a park path",
        highlight: 6,
        caption: "5k done",
        via: "app",
        createdAt: wednesdayEvening - HOUR_MS,
      });
    });
    expect(await t.mutation(internal.checkins.nudge, { userId: maya })).toBeNull();
  });

  it("never texts in quiet hours and stops at three texts a day", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    await addTask(t, me);

    vi.setSystemTime(NOON + 10 * HOUR_MS + 30 * MINUTE_MS); // 10:30 PM
    expect(await t.mutation(internal.checkins.nudge, { userId: me })).toBeNull();

    vi.setSystemTime(NOON);
    await t.run(async (ctx) => {
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("checkinNudges", { userId: me, kind: "rival_passed", day: "2026-11-15", text: "…", sentAt: NOON });
      }
    });
    expect(await t.mutation(internal.checkins.nudge, { userId: me })).toBeNull();
  });
});

describe("check-ins for a player who is pushed instead of texted", () => {
  it("pushes the last-day nudge once, logs it like a text, and tells nobody who has no phone to reach", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Me", "Maya"]);
    const [me, maya] = userIds;
    await addTask(t, me);
    await addTask(t, maya);
    await pushInsteadOfText(t, me);
    await t.run((ctx) => ctx.db.patch("users", maya, { keikiOptIn: undefined }));

    const text = await t.mutation(internal.checkins.nudge, { userId: me });
    expect(text).toMatch(/^Last day\. Body is still open\./);
    expect(await t.mutation(internal.checkins.nudge, { userId: me })).toBeNull();
    expect(await t.mutation(internal.checkins.nudge, { userId: maya })).toBeNull();

    // The log row is what holds a push to the same limits as a text.
    expect(await textsTo(t, me)).toEqual([text]);
    expect(await textsTo(t, maya)).toEqual([]);
    expect(await scheduledTo(t, "keiki:send")).toEqual([]);
    expect(await scheduledTo(t, "push:send")).toEqual([
      {
        userId: me,
        notification: {
          id: `settling:${leagueId}:${WEEK_START + 7 * DAY_MS}`,
          kind: "settlement",
          title: "YC Hackathon settles in 12h",
          body: "Last chance to prove what's still open.",
          url: "/",
        },
      },
    ]);
  });

  it("pushes the evening nudge with the task to prove tonight", async () => {
    const t = convexTest(schema, modules);
    // The following week, on its Wednesday at 6 PM: a day that is not the last one.
    const weekStart = WEEK_START + 7 * DAY_MS;
    vi.setSystemTime(weekStart + 2 * DAY_MS + 18 * HOUR_MS);
    const { userIds } = await startLeague(t, ["Me"], weekStart);
    const [me] = userIds;
    await addTask(t, me, { weekStart });
    await addTask(t, me, { weekStart, slot: "chores", title: "Laundry", points: 20 });
    await pushInsteadOfText(t, me);

    await t.mutation(internal.checkins.nudge, { userId: me });

    expect(await scheduledTo(t, "push:send")).toEqual([
      {
        userId: me,
        notification: {
          id: "nudge:2026-11-18",
          kind: "nudge",
          title: "2 tasks still open",
          body: "Leg day is worth +40. Prove it tonight.",
          url: "/",
        },
      },
    ]);
  });

  it("pushes the member the prover just went past", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Me", "Maya Chen", "Sam"]);
    const [me, maya, sam] = userIds;
    await addTask(t, me, { slot: "mind", title: "Problem set", points: 30, status: "verified" });
    await addTask(t, sam, { points: 100, status: "verified" }); // the leader throughout
    const mayas = await addTask(t, maya, { title: "5k run", points: 45, status: "verified" });
    await pushInsteadOfText(t, me);

    await t.mutation(internal.checkins.afterProof, { taskId: mayas });

    expect(await textsTo(t, me)).toEqual(["Maya just passed you in YC Hackathon, up 15."]);
    expect(await scheduledTo(t, "keiki:send")).toEqual([]);
    expect(await scheduledTo(t, "push:send")).toEqual([
      {
        userId: me,
        notification: {
          id: `rival:${leagueId}:${maya}`,
          kind: "rival",
          title: "Maya Chen passed you",
          body: "You're 15 points behind. Prove a task to take it back.",
          url: "/leaderboards",
        },
      },
    ]);
  });

  it("keeps texting a player who plays by text, and schedules no push nobody would get", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me"]);
    const [me] = userIds;
    await addTask(t, me);

    const text = await t.mutation(internal.checkins.nudge, { userId: me });

    expect(await scheduledTo(t, "keiki:send")).toEqual([{ userId: me, text }]);
    expect(await scheduledTo(t, "push:send")).toEqual([]);
  });

  it("has the hourly sweep look at players it could text or push, and nobody else", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Texted", "Pushed", "Neither"]);
    const [texted, pushed, neither] = userIds;
    await pushInsteadOfText(t, pushed);
    await t.run((ctx) => ctx.db.patch("users", neither, { keikiOptIn: undefined }));

    await t.mutation(internal.checkins.sweep, {});

    expect(await scheduledTo(t, "checkins:nudge")).toEqual([{ userId: texted }, { userId: pushed }]);
  });
});

describe("checkins.afterProof", () => {
  it("texts the member the prover just went past, and nobody on the next proof that changes no order", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me", "Maya Chen", "Sam"]);
    const [me, maya, sam] = userIds;
    await addTask(t, me);
    await addTask(t, me, { slot: "mind", title: "Problem set", points: 30, status: "verified" });
    await addTask(t, sam, { points: 100, status: "verified" });
    // Maya was on 0 and has just proved a 45-point task, which carries her past me (30) but not Sam.
    const mayas = await addTask(t, maya, { title: "5k run", points: 45, status: "verified" });

    await t.mutation(internal.checkins.afterProof, { taskId: mayas });
    expect(await textsTo(t, me)).toEqual([
      "Maya just passed you in YC Hackathon, up 15. Leg day flips it. Reply with a photo.",
    ]);
    expect(await textsTo(t, sam)).toEqual([]);

    // Her next proof keeps the order: the marks left by the first one are the new "before".
    const second = await addTask(t, maya, { slot: "chores", title: "Laundry", points: 10, status: "verified" });
    await t.mutation(internal.checkins.afterProof, { taskId: second });
    expect(await textsTo(t, me)).toHaveLength(1);
  });

  it("counts the bonuses a first proof earned when it works out who was passed", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me", "Maya", "Sam"]);
    const [me, maya, sam] = userIds;
    // I have 20 (a flex task earns no slot bonus). Maya had nothing and proves a drafted Body task:
    // 45 for the task and 25 for the slot is 70. Taking only the 45 off would put her "before" at
    // 25, already ahead of me, and the pass would go unsaid. Sam leads throughout.
    await addTask(t, sam, { points: 100, status: "verified" });
    await addTask(t, me, { slot: "flex", source: "flex", title: "Sunset walk", points: 20, status: "verified" });
    const run = await addTask(t, maya, { title: "5k run", points: 45, status: "verified" });

    await t.mutation(internal.checkins.afterProof, { taskId: run });
    expect(await textsTo(t, me)).toEqual(["Maya just passed you in YC Hackathon, up 50."]);
  });

  it("still reports a pass when another member's proof landed in the same moment and its hook ran first", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me", "Maya", "Sam", "Jo"]);
    const [me, maya, sam, jo] = userIds;
    await addTask(t, jo, { points: 100, status: "verified" }); // the leader throughout
    await addTask(t, me, { slot: "flex", source: "flex", title: "Sunset walk", points: 30, status: "verified" });
    const mayas = await addTask(t, maya, { title: "5k run", points: 45, status: "verified" }); // 70: past me
    const sams = await addTask(t, sam, { slot: "flex", source: "flex", title: "Stretch", points: 10, status: "verified" });

    // Both tasks are verified before either hook runs, so Sam's hook already sees Maya's points.
    await t.mutation(internal.checkins.afterProof, { taskId: sams });
    await t.mutation(internal.checkins.afterProof, { taskId: mayas });
    expect(await textsTo(t, me)).toEqual(["Maya just passed you in YC Hackathon, up 40."]);
  });

  it("starts every week from zero: last week's marks neither hide a pass nor invent one", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Me", "Maya", "Sam", "Jo"]);
    const [me, maya, sam, jo] = userIds;
    // Last week ended Sam 200, Maya 150, me 40. This week Jo leads on 125 and I have 30.
    await addTask(t, jo, { points: 100, status: "verified" });
    await t.run(async (ctx) => {
      for (const [userId, points] of [[sam, 200], [maya, 150], [me, 40]] as const) {
        await ctx.db.insert("checkinMarks", { leagueId, userId, points, weekStart: WEEK_START - 7 * DAY_MS });
      }
    });
    await addTask(t, me, { slot: "flex", source: "flex", title: "Sunset walk", points: 30, status: "verified" });
    const run = await addTask(t, maya, { title: "5k run", points: 45, status: "verified" });

    await t.mutation(internal.checkins.afterProof, { taskId: run });
    // Maya went from nothing to 70 this week: past me, and not past Sam, who has nothing yet.
    expect(await textsTo(t, me)).toEqual(["Maya just passed you in YC Hackathon, up 40."]);
    expect(await textsTo(t, sam)).toEqual([]);
    // Her row moved to this week; no fourth row was added.
    expect(await t.run((ctx) => ctx.db.query("checkinMarks").collect())).toHaveLength(3);
  });

  it("invents no pass over a member whose points fell without a proof of their own", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, userIds } = await startLeague(t, ["Me", "Maya", "Jo"]);
    const [me, maya, jo] = userIds;
    await addTask(t, jo, { points: 100, status: "verified" }); // the leader throughout
    // My last proof left me on 50. A challenge has since held it, and I stand on 20.
    await addTask(t, me, { slot: "flex", source: "flex", title: "Sunset walk", points: 20, status: "verified" });
    await addTask(t, me, { slot: "flex", source: "flex", title: "Meal prep", points: 30, status: "held" });
    // Maya was already ahead of that on 40, and proves ten more.
    await addTask(t, maya, { slot: "flex", source: "flex", title: "Stretch", points: 40, status: "verified" });
    await t.run(async (ctx) => {
      await ctx.db.insert("checkinMarks", { leagueId, userId: me, points: 50, weekStart: WEEK_START });
      await ctx.db.insert("checkinMarks", { leagueId, userId: maya, points: 40, weekStart: WEEK_START });
    });
    const more = await addTask(t, maya, { slot: "flex", source: "flex", title: "Tidy desk", points: 10, status: "verified" });

    await t.mutation(internal.checkins.afterProof, { taskId: more });
    expect(await textsTo(t, me)).toEqual([]);
  });

  it("leaves a pass that took the league's lead to the league's own text: one text per event", async () => {
    const t = convexTest(schema, modules);
    const { userIds } = await startLeague(t, ["Me", "Maya"]);
    const [me, maya] = userIds;
    await addTask(t, me, { slot: "mind", title: "Problem set", points: 30, status: "verified" }); // 55: the leader
    const run = await addTask(t, maya, { title: "5k run", points: 45, status: "verified" }); // 70: the new leader

    await t.mutation(internal.checkins.afterProof, { taskId: run });
    // leadChange tells the whole league that Maya took the lead, me included.
    expect(await textsTo(t, me)).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("checkinMarks").collect())).toHaveLength(1);
  });
});
