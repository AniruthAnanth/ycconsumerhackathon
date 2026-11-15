// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { challengerPointsByUser } from "./challenges";
import schema from "./schema";
import { VETO_WINDOW_MS, vetoClosesAt, vetoesNeeded } from "./vetoes";
import { DAY_MS, weekStartOf } from "./lib/week";

const modules = import.meta.glob("./**/*.ts");
const NOW = Date.UTC(2026, 10, 16, 20, 0, 0);

describe("veto majority math", () => {
  it("needs a majority of the owner's leaguemates, and at least two where there are two", () => {
    expect(vetoesNeeded(0)).toBe(Infinity);
    expect(vetoesNeeded(1)).toBe(1);
    expect(vetoesNeeded(2)).toBe(2);
    expect(vetoesNeeded(3)).toBe(2);
    expect(vetoesNeeded(4)).toBe(3);
    expect(vetoesNeeded(5)).toBe(3);
    expect(vetoesNeeded(7)).toBe(4);
  });

  it("closes at the later of 24 hours after the task and the week's midpoint", () => {
    const weekStart = 1_000_000;
    expect(vetoClosesAt({ addedAt: weekStart, weekStart })).toBe(weekStart + 3.5 * DAY_MS);
    const late = weekStart + 5 * DAY_MS;
    expect(vetoClosesAt({ addedAt: late, weekStart })).toBe(late + VETO_WINDOW_MS);
  });
});

describe("task and proof vetoes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv("KEIKI_AGENT_ID", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** Maya, Sam, Kai and Noor in one league; Maya has an open gym task this week. */
  async function setup() {
    const t = convexTest(schema, modules);
    const weekStart = weekStartOf(NOW);
    const ids = await t.run(async (ctx) => {
      const [maya, sam, kai, noor] = await Promise.all(
        ["Maya", "Sam", "Kai", "Noor"].map((name) => ctx.db.insert("users", { name })),
      );
      const leagueId = await ctx.db.insert("leagues", {
        name: "Veto League",
        inviteCode: "VETO01",
        stakeUsd: 0,
        visibility: "private",
        maxMembers: 8,
        createdBy: maya,
      });
      for (const userId of [maya, sam, kai, noor]) {
        await ctx.db.insert("memberships", { leagueId, userId, paid: true, joinedAt: NOW });
      }
      const taskId = await ctx.db.insert("tasks", {
        userId: maya,
        weekStart,
        slot: "body",
        title: "Walk to the fridge",
        points: 30,
        proofType: "photo",
        status: "open",
        source: "draft",
      });
      return { maya, sam, kai, noor, leagueId, taskId };
    });
    const as = (userId: Id<"users">) => t.withIdentity({ subject: userId + "|test-session" });
    const task = () => t.run((ctx) => ctx.db.get("tasks", ids.taskId));
    return { t, as, task, weekStart, ...ids };
  }

  it("strikes a task once a majority of the other members veto it", async () => {
    const { as, task, maya, sam, kai, leagueId, taskId } = await setup();

    await as(sam).mutation(api.vetoes.cast, { taskId, leagueId });
    const board = await as(maya).query(api.vetoes.board, { leagueId });
    expect(board).toEqual([expect.objectContaining({ taskId, votes: 1, needed: 2, canVote: false, struck: false })]);
    expect((await task())?.struck).toBeUndefined();

    await as(kai).mutation(api.vetoes.cast, { taskId, leagueId });
    expect(await task()).toMatchObject({ struck: true, status: "failed" });
  });

  it("holds one veto per member, which a second tap takes back", async () => {
    const { as, task, sam, leagueId, taskId } = await setup();
    await as(sam).mutation(api.vetoes.cast, { taskId, leagueId });
    await as(sam).mutation(api.vetoes.cast, { taskId, leagueId });
    expect(await as(sam).query(api.vetoes.board, { leagueId })).toEqual([
      expect.objectContaining({ votes: 0, mine: false, canVote: true }),
    ]);
    expect((await task())?.struck).toBeUndefined();
  });

  it("refuses a veto on your own task and after the window closes", async () => {
    const { as, maya, sam, leagueId, taskId, weekStart } = await setup();
    await expect(as(maya).mutation(api.vetoes.cast, { taskId, leagueId })).rejects.toThrow("own task");
    vi.setSystemTime(Math.max(NOW + VETO_WINDOW_MS, weekStart + 3.5 * DAY_MS) + 1);
    await expect(as(sam).mutation(api.vetoes.cast, { taskId, leagueId })).rejects.toThrow("closed");
  });

  it("lets the owner swap a struck task back into play", async () => {
    const { as, task, maya, sam, kai, leagueId, taskId } = await setup();
    await as(sam).mutation(api.vetoes.cast, { taskId, leagueId });
    await as(kai).mutation(api.vetoes.cast, { taskId, leagueId });
    await expect(as(sam).mutation(api.vetoes.swap, { taskId, title: "Run a 10k" })).rejects.toThrow();
    await as(maya).mutation(api.vetoes.swap, { taskId, title: "Run a 10k" });
    expect(await task()).toMatchObject({ title: "Run a 10k", struck: false, status: "open" });
  });

  it("sends an unsure verdict to the league, and a majority veto reverses its points", async () => {
    const { t, as, task, maya, sam, kai, noor, leagueId, taskId, weekStart } = await setup();
    const proofId = await t.run(async (ctx) => {
      await ctx.db.patch("tasks", taskId, { status: "held" });
      return await ctx.db.insert("proofs", {
        taskId,
        userId: maya,
        weekStart,
        mediaType: "photo",
        pass: true,
        confidence: 0.55,
        reason: "Hard to tell",
        highlight: 3,
        caption: "Fridge",
        via: "app",
        createdAt: NOW,
      });
    });
    await t.mutation(internal.challenges.refereeVote, { proofId });
    const challenge = await t.run((ctx) => ctx.db.query("challenges").first());
    expect(challenge).toMatchObject({ byReferee: true, status: "open", leagueId });
    expect((await task())?.status).toBe("held");

    await expect(
      as(maya).mutation(api.challenges.vote, { challengeId: challenge!._id, legit: true }),
    ).rejects.toThrow();
    await as(sam).mutation(api.challenges.vote, { challengeId: challenge!._id, legit: false });
    await as(kai).mutation(api.challenges.vote, { challengeId: challenge!._id, legit: false });
    await as(noor).mutation(api.challenges.vote, { challengeId: challenge!._id, legit: true });

    expect(await t.run((ctx) => ctx.db.get("challenges", challenge!._id))).toMatchObject({ status: "overturned" });
    // The points are gone: the task is open again, not verified.
    expect((await task())?.status).toBe("open");
    // Nobody challenged, so no stake moves.
    const moved = await t.run(async (ctx) => (await challengerPointsByUser(ctx, leagueId, { from: 0, to: NOW + DAY_MS })).size);
    expect(moved).toBe(0);
  });

  it("lets an unsure verdict count when the league backs it", async () => {
    const { t, as, task, maya, sam, kai, noor, taskId, weekStart } = await setup();
    const proofId = await t.run(async (ctx) => {
      await ctx.db.patch("tasks", taskId, { status: "held" });
      return await ctx.db.insert("proofs", {
        taskId, userId: maya, weekStart, mediaType: "photo", pass: true, confidence: 0.5,
        reason: "Hard to tell", highlight: 3, caption: "Fridge", via: "app", createdAt: NOW,
      });
    });
    await t.mutation(internal.challenges.refereeVote, { proofId });
    const challenge = await t.run((ctx) => ctx.db.query("challenges").first());
    for (const voter of [sam, kai, noor]) {
      await as(voter).mutation(api.challenges.vote, { challengeId: challenge!._id, legit: true });
    }
    expect((await task())?.status).toBe("verified");
  });
});
