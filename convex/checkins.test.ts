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
    expect(prompt?.line).toBe("Sam's up 115. Leg day cuts it to 45.");
  });

  it("puts a live quick-time drop first, with its countdown and the gesture for the camera", async () => {
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
    const pushUps = await addTask(t, me, { title: "20 push-ups", source: "drop", dropId });

    expect(await as(t, me).query(api.checkins.prompt, { leagueId, now: NOON })).toEqual({
      kind: "drop",
      taskId: pushUps,
      label: "LIVE 47M",
      line: "20 push-ups, +40.",
      task: { title: "20 push-ups", points: 40, proofType: "photo", gesture: "three fingers up" },
    });
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
});
