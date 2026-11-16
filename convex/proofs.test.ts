// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { judgeProof } from "./ai";
import type { Judgement } from "./lib/verdict";
import schema from "./schema";

// No test may reach OpenAI: each one says what the referee saw.
vi.mock("./ai", async (original) => ({
  ...(await original<typeof import("./ai")>()),
  judgeProof: vi.fn(),
}));

const modules = import.meta.glob("./**/*.ts");

type Backend = TestConvex<typeof schema>;

const WEEK_START = Date.UTC(2026, 10, 9, 8); // Monday 00:00 in Los Angeles
const NOW = Date.UTC(2026, 10, 15, 20);
const YC_OFFICE = { name: "YC office", lat: 37.7609, lng: -122.3862 };

/** What the model says about a clean, honest proof. Each test overrides only what it is about. */
function sees(overrides: Partial<Judgement> = {}): Judgement {
  return {
    pass: true,
    confidence: 0.9,
    reason: "Squat rack and mirror visible, matches leg day.",
    highlight: 6,
    caption: "Leg day survived",
    gestureSeen: null,
    sceneMatchesPlace: null,
    flags: [],
    activityFrames: 3,
    scene: "you at the squat rack",
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(judgeProof).mockResolvedValue(sees());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

/** A backend with one signed-in player who has one open task. */
async function playerWithTask(task: Partial<Doc<"tasks">> = {}) {
  const t = convexTest(schema, modules);
  // The task was on the lineup an hour before the tests' timelapses start.
  vi.setSystemTime(NOW - 60 * 60_000);
  const { userId, taskId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Sam" });
    const taskId = await ctx.db.insert("tasks", {
      userId,
      weekStart: WEEK_START,
      slot: "body",
      title: "Leg day at the gym",
      points: 30,
      proofType: "photo",
      status: "open",
      source: "draft",
      ...task,
    });
    return { userId, taskId };
  });
  vi.setSystemTime(NOW);
  return {
    t,
    userId,
    taskId,
    as: t.withIdentity({ subject: userId + "|session" }),
  };
}

// Every upload is a new shot: identical bytes would be caught as a reused image.
let shots = 0;
const upload = (t: Backend, type = "image/jpeg", bytes = `shot ${++shots}`) =>
  t.run((ctx) => ctx.storage.store(new Blob([bytes], { type })));

/** An honest 10-minute timelapse: three fresh stills ending now, to spread into a verify call. */
async function frames(t: Backend, count = 3, minutes = 10) {
  const frameStorageIds = await Promise.all(
    Array.from({ length: count }, () => upload(t)),
  );
  const frameTimes = frameStorageIds.map(
    (_, i) =>
      NOW - Math.round(((count - 1 - i) / (count - 1)) * minutes * 60_000),
  );
  return { frameStorageIds, frameTimes, durationSec: minutes * 60 };
}

/** The smallest file a phone could call a video of this length: a movie box holding only its header. */
function clipOfSeconds(seconds: number): Uint8Array<ArrayBuffer> {
  const file = new Uint8Array(8 + 8 + 100);
  const view = new DataView(file.buffer);
  const name = (at: number, type: string) =>
    file.set(
      [...type].map((c) => c.charCodeAt(0)),
      at,
    );
  view.setUint32(0, file.length);
  name(4, "moov");
  view.setUint32(8, 108);
  name(12, "mvhd");
  view.setUint32(16 + 12, 1000); // timescale: units per second
  view.setUint32(16 + 16, seconds * 1000);
  return file;
}

const taskOf = (t: Backend, taskId: Id<"tasks">) =>
  t.run((ctx) => ctx.db.get("tasks", taskId));
const proofsOf = (t: Backend) =>
  t.run((ctx) => ctx.db.query("proofs").collect());

describe("proofs.verify", () => {
  it("verifies the task, writes the proof and returns the referee's call", async () => {
    const { t, as, userId, taskId } = await playerWithTask();
    const storageId = await upload(t);

    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId,
      mediaType: "photo",
      ...(await frames(t)),
    });

    expect(verdict).toEqual({
      pass: true,
      confidence: 0.9,
      reason: "Timelapse 10 min · you at the squat rack in 3/3 frames",
      highlight: 6,
      caption: "Leg day survived",
      points: 30,
      closeCall: false,
      flags: [],
      needsVote: false,
    });
    expect(vi.mocked(judgeProof).mock.calls[0][0]).toMatchObject({
      taskTitle: "Leg day at the gym",
      slot: "body",
      fromVideo: false,
      imageUrls: [expect.any(String), expect.any(String), expect.any(String)],
    });
    expect((await taskOf(t, taskId))?.status).toBe("verified");
    expect(await proofsOf(t)).toMatchObject([
      {
        taskId,
        userId,
        weekStart: WEEK_START,
        storageId,
        mediaType: "photo",
        pass: true,
        confidence: 0.9,
        via: "app",
      },
    ]);
  });

  it("has the league's lead rechecked after a pass, and not after a fail", async () => {
    const { t, as, userId, taskId } = await playerWithTask();
    const leagueId = await t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", {
        name: "YC Hackathon",
        inviteCode: "YCHACK",
        stakeUsd: 5,
        visibility: "private",
        maxMembers: 12,
        createdBy: userId,
      });
      await ctx.db.insert("memberships", {
        leagueId,
        userId,
        paid: true,
        joinedAt: NOW,
      });
      await ctx.db.insert("weeks", {
        leagueId,
        number: 1,
        startsAt: WEEK_START,
        endsAt: WEEK_START + 7 * 24 * 60 * 60 * 1000,
        status: "open",
      });
      return leagueId;
    });
    const leaderOf = () =>
      t.run(
        async (ctx) =>
          (await ctx.db.get("leagues", leagueId))?.leaderId ?? null,
      );
    const settle = async () => {
      vi.advanceTimersByTime(1);
      await t.finishInProgressScheduledFunctions();
    };

    vi.mocked(judgeProof).mockResolvedValueOnce(
      sees({ pass: false, confidence: 0.1 }),
    );
    await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });
    await settle();
    expect(await leaderOf()).toBeNull();

    await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });
    await settle();
    expect(await leaderOf()).toBe(userId);
  });

  it("leaves the task open after a failed proof, so the player can try again", async () => {
    const { t, as, taskId } = await playerWithTask();
    vi.mocked(judgeProof).mockResolvedValueOnce(
      sees({
        pass: false,
        confidence: 0.05,
        reason: "A slice of pizza on a plate, not leg day.",
      }),
    );

    const wrong = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });
    expect(wrong).toMatchObject({
      pass: false,
      points: 0,
      reason: "A slice of pizza on a plate, not leg day.",
    });
    expect((await taskOf(t, taskId))?.status).toBe("open");

    const right = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });
    expect(right.pass).toBe(true);
    expect((await taskOf(t, taskId))?.status).toBe("verified");
    expect((await proofsOf(t)).map((proof) => proof.pass)).toEqual([
      false,
      true,
    ]);
  });

  it("pushes the prover the referee's call, pass or fail", async () => {
    const { t, as, userId, taskId } = await playerWithTask();
    vi.mocked(judgeProof).mockResolvedValueOnce(
      sees({
        pass: false,
        confidence: 0.05,
        reason: "A slice of pizza on a plate, not leg day.",
      }),
    );

    await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });
    await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });

    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(
      scheduled
        .filter((job) => job.name === "push:send")
        .map((job) => job.args[0]),
    ).toEqual([
      {
        userId,
        notification: {
          id: `verdict:${taskId}:fail`,
          kind: "verdict",
          title: "Not verified",
          body: "Leg day at the gym. A slice of pizza on a plate, not leg day. Retry any time this week.",
          url: `/task/${taskId}`,
        },
      },
      {
        userId,
        notification: {
          id: `verdict:${taskId}:pass`,
          kind: "verdict",
          title: "Verified: +30",
          body: "Leg day at the gym. Timelapse 10 min · you at the squat rack in 3/3 frames",
          url: `/task/${taskId}`,
        },
      },
    ]);
  });

  it("fails below 0.3, sends 0.3 to 0.6 to a league vote and flags 0.6 to 0.75 as a close call", async () => {
    const { t, as, taskId } = await playerWithTask();

    vi.mocked(judgeProof).mockResolvedValueOnce(
      sees({ pass: false, confidence: 0.2 }),
    );
    const wrong = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });
    expect(wrong).toMatchObject({ pass: false, needsVote: false, points: 0 });

    vi.mocked(judgeProof).mockResolvedValueOnce(sees({ confidence: 0.7 }));
    const close = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });
    expect(close).toMatchObject({ pass: true, closeCall: true, points: 30 });
  });

  it("refuses a task that is not the caller's, or not open", async () => {
    const { t, as, taskId } = await playerWithTask();
    const strangerId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Stranger" }),
    );
    const asStranger = t.withIdentity({ subject: strangerId + "|session" });
    const storageId = await upload(t);

    await expect(
      asStranger.action(api.proofs.verify, {
        taskId,
        storageId,
        mediaType: "photo",
        ...(await frames(t)),
      }),
    ).rejects.toThrow("isn't on your lineup");
    await as.action(api.proofs.verify, {
      taskId,
      storageId,
      mediaType: "photo",
      ...(await frames(t)),
    });
    await expect(
      as.action(api.proofs.verify, {
        taskId,
        storageId,
        mediaType: "photo",
        ...(await frames(t)),
      }),
    ).rejects.toThrow("already verified");
    expect(judgeProof).toHaveBeenCalledOnce();
    expect(await proofsOf(t)).toHaveLength(1);
  });

  it("asks for a retake when the model can't read the photo, and leaves the task open", async () => {
    const { t, as, taskId } = await playerWithTask();
    vi.mocked(judgeProof).mockResolvedValueOnce(null);

    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });

    expect(verdict).toMatchObject({
      pass: false,
      points: 0,
      reason: "That shot couldn't be read. Take it again.",
    });
    expect((await taskOf(t, taskId))?.status).toBe("open");
  });

  it("turns away a file the model can't read without calling it", async () => {
    const { t, as, taskId } = await playerWithTask();
    const shot = await frames(t);
    shot.frameStorageIds[1] = await upload(t, "image/heic");
    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: shot.frameStorageIds[2],
      mediaType: "photo",
      ...shot,
    });
    expect(verdict).toMatchObject({
      pass: false,
      reason: expect.stringContaining("file type"),
    });
    expect(judgeProof).not.toHaveBeenCalled();
  });
});

describe("gesture check on a drop task", () => {
  async function dropTask() {
    const base = await playerWithTask();
    await base.t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", {
        name: "YC Hackathon",
        inviteCode: "YCHACK",
        stakeUsd: 5,
        visibility: "private",
        maxMembers: 12,
        createdBy: base.userId,
      });
      const dropId = await ctx.db.insert("drops", {
        leagueId,
        kind: "quicktime",
        title: "20 push-ups",
        slot: "body",
        points: 40,
        gesture: "three fingers up",
        opensAt: NOW,
        closesAt: NOW + 60 * 60 * 1000,
        status: "open",
      });
      await ctx.db.patch("tasks", base.taskId, {
        title: "20 push-ups",
        points: 40,
        source: "drop",
        dropId,
      });
    });
    return base;
  }

  it("asks the model for the drop's gesture and fails without it", async () => {
    const { t, as, taskId } = await dropTask();
    vi.mocked(judgeProof).mockResolvedValueOnce(sees({ gestureSeen: false }));

    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });

    expect(vi.mocked(judgeProof).mock.calls[0][0].gesture).toBe(
      "three fingers up",
    );
    expect(verdict.pass).toBe(false);
    expect(verdict.reason).toContain("three fingers up");
    expect((await taskOf(t, taskId))?.status).toBe("open");
  });

  it("passes with the gesture and hands the task to drops for its bonus", async () => {
    const { t, as, taskId } = await dropTask();
    vi.mocked(judgeProof).mockResolvedValueOnce(sees({ gestureSeen: true }));

    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });
    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();

    expect(verdict.pass).toBe(true);
    // drops.onTaskVerified prices the first finisher: 40 for the drop plus 10.
    expect(await taskOf(t, taskId)).toMatchObject({
      status: "verified",
      points: 50,
    });
  });
});

describe("location check-in", () => {
  const checkIn = {
    proofType: "photo_location" as const,
    title: "Check in at YC office",
    place: YC_OFFICE,
  };

  it("fails from across town without calling the model", async () => {
    const { t, as, taskId } = await playerWithTask(checkIn);
    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
      lat: YC_OFFICE.lat + 0.045, // about 5 km north
      lng: YC_OFFICE.lng,
    });
    expect(verdict).toMatchObject({
      pass: false,
      reason: "You're 5.0 km from YC office. Check in within 150 m.",
    });
    expect(judgeProof).not.toHaveBeenCalled();
    expect(await proofsOf(t)).toMatchObject([
      { pass: false, lat: YC_OFFICE.lat + 0.045 },
    ]);
  });

  it("fails when the phone sent no location", async () => {
    const { t, as, taskId } = await playerWithTask(checkIn);
    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });
    expect(verdict.reason).toContain("Location is needed");
    expect(judgeProof).not.toHaveBeenCalled();
  });

  it("needs the scene to match as well as the distance", async () => {
    const { t, as, taskId } = await playerWithTask(checkIn);
    const near = { lat: YC_OFFICE.lat + 0.0003, lng: YC_OFFICE.lng }; // about 33 m north

    vi.mocked(judgeProof).mockResolvedValueOnce(
      sees({
        pass: false,
        sceneMatchesPlace: false,
        reason: "That's a gym, not an office.",
      }),
    );
    const wrongScene = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
      ...near,
    });
    expect(wrongScene).toMatchObject({
      pass: false,
      reason: "That's a gym, not an office.",
    });

    vi.mocked(judgeProof).mockResolvedValueOnce(
      sees({
        sceneMatchesPlace: true,
        reason: "Desks and monitors, an office.",
      }),
    );
    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
      ...near,
    });
    expect(verdict).toMatchObject({
      pass: true,
      points: 30,
      reason:
        "Timelapse 10 min · you at the squat rack in 3/3 frames (33 m from YC office)",
    });
    expect(vi.mocked(judgeProof).mock.calls[1][0].placeName).toBe("YC office");
  });
});

describe("group session check-in", () => {
  const session = {
    proofType: "photo_location" as const,
    source: "group" as const,
    title: "Morning standup",
    place: YC_OFFICE,
  };
  const near = { lat: YC_OFFICE.lat + 0.0003, lng: YC_OFFICE.lng }; // about 33 m north

  it("is judged on who came, not on whether the scene looks like the place", async () => {
    const { t, as, taskId } = await playerWithTask(session);
    vi.mocked(judgeProof).mockResolvedValueOnce(
      sees({
        sceneMatchesPlace: null,
        reason: "Four friends together on a grassy hill.",
      }),
    );

    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
      ...near,
    });

    expect(verdict).toMatchObject({ pass: true, points: 30 });
    expect(vi.mocked(judgeProof).mock.calls[0][0]).toMatchObject({
      groupSession: true,
      placeName: undefined,
    });
  });

  it("still needs the phone to be at the place", async () => {
    const { t, as, taskId } = await playerWithTask(session);
    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
      lat: YC_OFFICE.lat + 0.045,
      lng: YC_OFFICE.lng,
    });
    expect(verdict.reason).toBe(
      "You're 5.0 km from YC office. Check in within 150 m.",
    );
    expect(judgeProof).not.toHaveBeenCalled();
  });
});

describe("league vote for an unsure referee", () => {
  it("holds the task with no points and opens a vote in the player's league", async () => {
    const { t, as, userId, taskId } = await playerWithTask();
    await t.run(async (ctx) => {
      const mayaId = await ctx.db.insert("users", { name: "Maya" });
      const leagueId = await ctx.db.insert("leagues", {
        name: "HOME",
        inviteCode: "HOME",
        stakeUsd: 0,
        visibility: "private",
        maxMembers: 12,
        createdBy: userId,
      });
      for (const member of [userId, mayaId])
        await ctx.db.insert("memberships", {
          leagueId,
          userId: member,
          paid: true,
          joinedAt: NOW,
        });
    });
    vi.mocked(judgeProof).mockResolvedValueOnce(
      sees({
        pass: false,
        confidence: 0.45,
        reason: "A dim room, maybe a gym.",
      }),
    );

    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });
    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();

    expect(verdict).toMatchObject({
      pass: true,
      needsVote: true,
      points: 0,
      reason: "Sent to the league for a vote. A dim room, maybe a gym.",
    });
    expect(await taskOf(t, taskId)).toMatchObject({ status: "held" });
    expect(await proofsOf(t)).toMatchObject([{ pass: true, needsVote: true }]);
    expect(
      await t.run((ctx) => ctx.db.query("challenges").collect()),
    ).toMatchObject([{ byReferee: true, status: "open" }]);
  });
});

describe("anti-cheat", () => {
  it("turns away an image already used for an earlier proof, without calling the model", async () => {
    const { t, as, userId, taskId } = await playerWithTask();
    vi.setSystemTime(NOW - 60 * 60_000);
    const otherTask = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId,
        weekStart: WEEK_START,
        slot: "mind",
        title: "Finish OS problem set",
        points: 30,
        proofType: "photo",
        status: "open",
        source: "draft",
      }),
    );
    vi.setSystemTime(NOW);
    const first = await frames(t);
    first.frameStorageIds[0] = await upload(t, "image/jpeg", "same bytes");
    await as.action(api.proofs.verify, {
      taskId,
      storageId: first.frameStorageIds[2],
      mediaType: "photo",
      ...first,
    });
    vi.mocked(judgeProof).mockClear();

    const second = await frames(t);
    second.frameStorageIds[0] = await upload(t, "image/jpeg", "same bytes");
    const verdict = await as.action(api.proofs.verify, {
      taskId: otherTask,
      storageId: second.frameStorageIds[2],
      mediaType: "photo",
      ...second,
    });

    expect(verdict).toMatchObject({ pass: false, flags: ["reused_image"] });
    expect(judgeProof).not.toHaveBeenCalled();
  });

  it("lets a player resend the shots of a proof that failed", async () => {
    const { t, as, taskId } = await playerWithTask();
    const stale = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t, "image/jpeg", "retry bytes"),
      mediaType: "photo",
      ...(await frames(t)),
      capturedAt: NOW - 20 * 60_000,
    });
    expect(stale.flags).toEqual(["stale_capture"]);

    const retry = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t, "image/jpeg", "retry bytes"),
      mediaType: "photo",
      ...(await frames(t)),
      capturedAt: NOW,
    });
    expect(retry).toMatchObject({ pass: true, points: 30 });
  });

  it("turns away a shot taken more than 15 minutes ago", async () => {
    const { t, as, taskId } = await playerWithTask();
    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
      capturedAt: NOW - 16 * 60_000,
    });
    expect(verdict).toMatchObject({ pass: false, flags: ["stale_capture"] });
    expect(judgeProof).not.toHaveBeenCalled();
  });
});

describe("timelapse rules", () => {
  it("judges up to 8 stills with their times and the target, and says what they showed", async () => {
    const { t, as, taskId } = await playerWithTask({
      slot: "recharge",
      title: "Read for 30 minutes",
      targetMinutes: 30,
    });
    const stills = [];
    for (let i = 0; i < 10; i++) stills.push(await upload(t));
    const frameTimes = stills.map((_, i) => NOW - (9 - i) * 200_000);
    vi.mocked(judgeProof).mockResolvedValueOnce(
      sees({ activityFrames: 8, scene: "you in the armchair reading" }),
    );

    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: stills[9],
      frameStorageIds: stills,
      frameTimes,
      durationSec: 1800,
      mediaType: "photo",
    });

    expect(verdict).toMatchObject({
      pass: true,
      reason: "Timelapse 30 min · you in the armchair reading in 8/8 frames",
    });
    const call = vi.mocked(judgeProof).mock.calls[0][0];
    expect(call).toMatchObject({ targetMinutes: 30, durationSec: 1800 });
    expect(call.imageUrls).toHaveLength(8);
  });

  it("judges a task stored as a photo or a Canvas task as a timelapse with a 10-minute default", async () => {
    for (const proofType of ["photo", "canvas"] as const) {
      const { t, as, taskId } = await playerWithTask({ proofType });
      const verdict = await as.action(api.proofs.verify, {
        taskId,
        storageId: await upload(t),
        mediaType: "photo",
        ...(await frames(t)),
      });
      expect(verdict.pass).toBe(true);
      expect(vi.mocked(judgeProof).mock.lastCall?.[0]).toMatchObject({
        targetMinutes: 10,
      });
    }
  });

  it("needs the stills to span 80% of the task's minutes", async () => {
    const { t, as, taskId } = await playerWithTask({ targetMinutes: 30 });
    const short = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t, 3, 20)),
    });
    expect(short).toMatchObject({
      pass: false,
      flags: ["too_short"],
      reason: "That timelapse covers 20 minutes; this task needs 30.",
    });
    expect(judgeProof).not.toHaveBeenCalled();
    const enough = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t, 3, 24)),
    });
    expect(enough.pass).toBe(true);
  });

  it("turns away a single photo", async () => {
    const { t, as, taskId } = await playerWithTask();
    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
    });
    expect(verdict).toMatchObject({ pass: false, flags: ["too_short"] });
    expect(judgeProof).not.toHaveBeenCalled();
  });

  it("turns away a loop of the same still", async () => {
    const { t, as, taskId } = await playerWithTask();
    const still = await upload(t, "image/jpeg", "one still");
    const again = await upload(t, "image/jpeg", "one still");
    const { frameTimes, durationSec } = await frames(t);
    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: again,
      mediaType: "photo",
      frameStorageIds: [still, again, await upload(t)],
      frameTimes,
      durationSec,
    });
    expect(verdict).toMatchObject({ pass: false, flags: ["static_frames"] });
    expect(judgeProof).not.toHaveBeenCalled();
  });

  it("turns away stills taken before the task was on the lineup", async () => {
    const { t, as, taskId } = await playerWithTask();
    const { frameStorageIds } = await frames(t);
    const frameTimes = [NOW - 2 * 60 * 60_000, NOW - 5 * 60_000, NOW];
    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: frameStorageIds[2],
      mediaType: "photo",
      frameStorageIds,
      frameTimes,
      durationSec: 7200,
    });
    expect(verdict).toMatchObject({ pass: false, flags: ["stale_capture"] });
    expect(judgeProof).not.toHaveBeenCalled();
  });

  it("fails when the activity shows in half the stills or fewer", async () => {
    const { t, as, taskId } = await playerWithTask();
    vi.mocked(judgeProof).mockResolvedValueOnce(
      sees({ activityFrames: 1, scene: "an empty squat rack" }),
    );
    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
    });
    expect(verdict).toMatchObject({
      pass: false,
      reason:
        "Timelapse 10 min · an empty squat rack in 1/3 frames. It has to show in most of them.",
      flags: ["not_doing_task"],
    });
  });
});

describe("video proofs", () => {
  it("judges the three stills the app sampled and keeps the clip on the proof", async () => {
    const { t, as, taskId } = await playerWithTask();
    const clip = await upload(t, "video/quicktime");
    const frameStorageIds = [await upload(t), await upload(t), await upload(t)];

    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: clip,
      mediaType: "video",
      ...(await frames(t)),
      frameStorageIds,
    });

    expect(verdict.pass).toBe(true);
    expect(vi.mocked(judgeProof).mock.calls[0][0]).toMatchObject({
      fromVideo: true,
    });
    expect(vi.mocked(judgeProof).mock.calls[0][0].imageUrls).toHaveLength(3);
    expect(await proofsOf(t)).toMatchObject([
      { storageId: clip, mediaType: "video", pass: true },
    ]);
  });

  it("turns away a clip longer than 10 seconds", async () => {
    const { t, as, taskId } = await playerWithTask();
    const clip = await t.run((ctx) =>
      ctx.storage.store(new Blob([clipOfSeconds(12)], { type: "video/mp4" })),
    );
    const frameStorageIds = [await upload(t), await upload(t), await upload(t)];

    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: clip,
      mediaType: "video",
      ...(await frames(t)),
      frameStorageIds,
    });

    expect(verdict).toMatchObject({
      pass: false,
      reason: "Clips can be up to 10 seconds. Record a shorter one.",
    });
    expect(judgeProof).not.toHaveBeenCalled();
    expect((await taskOf(t, taskId))?.status).toBe("open");
  });

  it("asks for a timelapse when a video arrives without stills", async () => {
    const { t, as, taskId } = await playerWithTask();
    const verdict = await as.action(api.proofs.verify, {
      taskId,
      storageId: await upload(t, "video/mp4"),
      mediaType: "video",
    });
    expect(verdict).toMatchObject({
      pass: false,
      reason: expect.stringContaining("Proofs are timelapses now"),
    });
    expect(judgeProof).not.toHaveBeenCalled();
    expect((await taskOf(t, taskId))?.status).toBe("open");
  });
});

describe("proofs.verifyForUser (Keiki)", () => {
  it("verifies for an explicit user with no one signed in", async () => {
    const { t, userId, taskId } = await playerWithTask();
    const verdict = await t.action(internal.proofs.verifyForUser, {
      userId,
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
      via: "keiki",
    });
    expect(verdict).toMatchObject({ pass: true, points: 30 });
    expect(await proofsOf(t)).toMatchObject([{ via: "keiki", pass: true }]);
  });

  it("sends a texted check-in back to the app, where location can be confirmed", async () => {
    const { t, userId, taskId } = await playerWithTask({
      proofType: "photo_location",
      place: YC_OFFICE,
    });
    const verdict = await t.action(internal.proofs.verifyForUser, {
      userId,
      taskId,
      storageId: await upload(t),
      mediaType: "photo",
      ...(await frames(t)),
      via: "keiki",
    });
    expect(verdict).toMatchObject({
      pass: false,
      reason: expect.stringContaining("from the app"),
    });
    expect(judgeProof).not.toHaveBeenCalled();
  });

  it("checks a texted check-in's distance, then asks for a timelapse", async () => {
    const { t, userId, taskId } = await playerWithTask({
      proofType: "photo_location",
      place: YC_OFFICE,
    });
    const texted = {
      userId,
      taskId,
      mediaType: "photo" as const,
      via: "keiki" as const,
    };

    const farAway = await t.action(internal.proofs.verifyForUser, {
      ...texted,
      storageId: await upload(t),
      lat: YC_OFFICE.lat + 0.045,
      lng: YC_OFFICE.lng,
    });
    expect(farAway.reason).toBe(
      "You're 5.0 km from YC office. Check in within 150 m.",
    );
    expect(judgeProof).not.toHaveBeenCalled();

    // At the place, a texted photo is still one photo, and every proof is now a timelapse.
    const verdict = await t.action(internal.proofs.verifyForUser, {
      ...texted,
      storageId: await upload(t),
      lat: YC_OFFICE.lat,
      lng: YC_OFFICE.lng,
    });
    expect(verdict).toMatchObject({ pass: false, flags: ["too_short"] });
    expect(judgeProof).not.toHaveBeenCalled();
  });

  it("asks a texted video for a timelapse from the app", async () => {
    const { t, userId, taskId } = await playerWithTask();
    const verdict = await t.action(internal.proofs.verifyForUser, {
      userId,
      taskId,
      storageId: await upload(t, "video/mp4"),
      mediaType: "video",
      via: "keiki",
    });
    expect(verdict.reason).toBe(
      "Proofs are timelapses now. Record one in the app while you do the task.",
    );
  });
});

describe("proofs.generateUploadUrl", () => {
  it("is for signed-in players only", async () => {
    const { t, as } = await playerWithTask();
    expect(await as.mutation(api.proofs.generateUploadUrl, {})).toEqual(
      expect.any(String),
    );
    await expect(t.mutation(api.proofs.generateUploadUrl, {})).rejects.toThrow(
      "Not signed in",
    );
  });
});
