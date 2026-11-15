// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  CHALLENGE_WINDOW_MS,
  CHALLENGER_STAKE,
  VOTE_WINDOW_MS,
  challengeOpenedText,
  challengeResultText,
  challengeWindowOpen,
  challengerDelta,
  challengerPointsByUser,
  decide,
  eligibleVoters,
  tally,
} from "./challenges";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("challenge rules", () => {
  it("lets a proof be challenged for 24 hours, the last instant included", () => {
    expect(challengeWindowOpen(1_000, 1_000)).toBe(true);
    expect(challengeWindowOpen(1_000, 1_000 + CHALLENGE_WINDOW_MS)).toBe(true);
    expect(challengeWindowOpen(1_000, 1_000 + CHALLENGE_WINDOW_MS + 1)).toBe(
      false,
    );
  });

  it("keeps the proof's owner and the challenger out of the vote", () => {
    expect(
      eligibleVoters(["maya", "sam", "kai", "noor"], "maya", "sam"),
    ).toEqual(["kai", "noor"]);
    expect(eligibleVoters(["maya", "sam"], "maya", "sam")).toEqual([]);
  });

  it("tallies votes by side", () => {
    expect(tally([])).toEqual({ legit: 0, notLegit: 0 });
    expect(
      tally([{ legit: true }, { legit: false }, { legit: false }]),
    ).toEqual({ legit: 1, notLegit: 2 });
  });

  it("overturns only on a majority against the proof", () => {
    expect(decide({ legit: 1, notLegit: 2 })).toBe("overturned");
    expect(decide({ legit: 2, notLegit: 1 })).toBe("upheld");
  });

  it("upholds the referee on a tie and when nobody votes", () => {
    expect(decide({ legit: 2, notLegit: 2 })).toBe("upheld");
    expect(decide({ legit: 0, notLegit: 0 })).toBe("upheld");
  });

  it("pays the challenger for an overturned proof and charges them for an upheld one", () => {
    expect(challengerDelta("overturned")).toBe(CHALLENGER_STAKE);
    expect(challengerDelta("upheld")).toBe(-CHALLENGER_STAKE);
    expect(challengerDelta("open")).toBe(0);
  });
});

describe("challenge texts", () => {
  it("tells the league who challenged whose proof and where to vote", () => {
    expect(challengeOpenedText("Sam", "Maya", "Leg day at the gym")).toBe(
      'Sam challenged Maya\'s "Leg day at the gym" proof. Vote in the app.',
    );
  });

  it("tells the league the result and what it cost or paid the challenger", () => {
    expect(
      challengeResultText("upheld", "Sam", "Maya", "Leg day at the gym"),
    ).toBe(
      'The league upheld Maya\'s "Leg day at the gym" proof. The points are back and Sam loses 10.',
    );
    expect(
      challengeResultText("overturned", "Sam", "Maya", "Leg day at the gym"),
    ).toBe(
      'The league overturned Maya\'s "Leg day at the gym" proof. The task reopens and Sam gets +10.',
    );
  });
});

describe("challenge lifecycle", () => {
  const NOW = Date.UTC(2026, 10, 15, 20, 0, 0);

  // What the league was texted. Keiki is not configured in tests, and keiki.send
  // then logs the text it would have sent as a warning.
  let texts: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv("KEIKI_AGENT_ID", "");
    texts = [];
    vi.spyOn(console, "warn").mockImplementation(
      (message: unknown) => void texts.push(String(message)),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * One league of four: Maya owns a verified gym proof, and Sam, Kai and Noor are
   * the other members. Olu plays in no league.
   */
  async function setup(options: { proofAgeMs?: number } = {}) {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const [maya, sam, kai, noor, olu] = await Promise.all(
        ["Maya", "Sam", "Kai", "Noor", "Olu"].map((name) =>
          ctx.db.insert("users", { name }),
        ),
      );
      const leagueId = await ctx.db.insert("leagues", {
        name: "YC Hackathon",
        inviteCode: "YC2026",
        stakeUsd: 5,
        visibility: "private",
        maxMembers: 8,
        createdBy: maya,
      });
      for (const userId of [maya, sam, kai, noor]) {
        await ctx.db.insert("memberships", {
          leagueId,
          userId,
          paid: true,
          joinedAt: NOW,
        });
      }
      const taskId = await ctx.db.insert("tasks", {
        userId: maya,
        weekStart: NOW,
        slot: "body",
        title: "Leg day at the gym",
        points: 40,
        proofType: "photo",
        status: "verified",
        source: "draft",
      });
      const proofId = await ctx.db.insert("proofs", {
        taskId,
        userId: maya,
        weekStart: NOW,
        mediaType: "photo",
        pass: true,
        confidence: 0.7,
        reason: "Barbell rack and mirror visible, matches leg day",
        highlight: 6,
        caption: "Leg day",
        via: "app",
        createdAt: NOW - (options.proofAgeMs ?? 0),
      });
      return { maya, sam, kai, noor, olu, leagueId, taskId, proofId };
    });
    // Convex Auth's getAuthUserId reads the user id from the part of the subject before "|".
    const as = (userId: Id<"users">) =>
      t.withIdentity({ subject: userId + "|test-session" });
    const taskStatus = () =>
      t.run(async (ctx) => (await ctx.db.get("tasks", ids.taskId))?.status);
    const challenge = (challengeId: Id<"challenges">) =>
      t.run((ctx) => ctx.db.get("challenges", challengeId));
    return { t, as, taskStatus, challenge, ...ids };
  }

  it("holds the task's points while the league votes", async () => {
    const { as, taskStatus, challenge, sam, leagueId, proofId } = await setup();

    const challengeId = await as(sam).mutation(api.challenges.open, {
      proofId,
      leagueId,
    });

    expect(await taskStatus()).toBe("held");
    expect(await challenge(challengeId)).toMatchObject({
      proofId,
      leagueId,
      challengerId: sam,
      status: "open",
      closesAt: NOW + VOTE_WINDOW_MS,
    });
  });

  it("overturns the proof and reopens the task once every eligible voter says not legit", async () => {
    const { t, as, taskStatus, challenge, sam, kai, noor, leagueId, proofId } =
      await setup();
    const challengeId = await as(sam).mutation(api.challenges.open, {
      proofId,
      leagueId,
    });

    await as(kai).mutation(api.challenges.vote, { challengeId, legit: false });
    expect((await challenge(challengeId))?.status).toBe("open");

    vi.setSystemTime(NOW + 60_000);
    await as(noor).mutation(api.challenges.vote, { challengeId, legit: false });

    expect(await challenge(challengeId)).toMatchObject({
      status: "overturned",
      closesAt: NOW + 60_000,
    });
    expect(await taskStatus()).toBe("open");

    // The close that open() scheduled still fires 12 hours later and must change nothing.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await challenge(challengeId)).toMatchObject({
      status: "overturned",
      closesAt: NOW + 60_000,
    });
    expect(await taskStatus()).toBe("open");
    expect(texts).toEqual([
      expect.stringContaining(
        'Sam challenged Maya\'s "Leg day at the gym" proof. Vote in the app.',
      ),
      expect.stringContaining("The league overturned Maya's"),
    ]);
  });

  it("upholds the proof and returns the points when the vote closes with no votes", async () => {
    const { t, as, taskStatus, challenge, sam, leagueId, proofId } =
      await setup();
    const challengeId = await as(sam).mutation(api.challenges.open, {
      proofId,
      leagueId,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await challenge(challengeId)).toMatchObject({
      status: "upheld",
      closesAt: NOW + VOTE_WINDOW_MS,
    });
    expect(await taskStatus()).toBe("verified");
    expect(texts).toEqual([
      expect.stringContaining("Sam challenged Maya's"),
      expect.stringContaining("The league upheld Maya's"),
    ]);
  });

  it("upholds the proof on a tie", async () => {
    const { as, taskStatus, challenge, sam, kai, noor, leagueId, proofId } =
      await setup();
    const challengeId = await as(sam).mutation(api.challenges.open, {
      proofId,
      leagueId,
    });

    await as(kai).mutation(api.challenges.vote, { challengeId, legit: true });
    await as(noor).mutation(api.challenges.vote, { challengeId, legit: false });

    expect((await challenge(challengeId))?.status).toBe("upheld");
    expect(await taskStatus()).toBe("verified");
  });

  it("replaces a voter's earlier vote instead of counting both", async () => {
    const { t, as, challenge, sam, kai, leagueId, proofId } = await setup();
    const challengeId = await as(sam).mutation(api.challenges.open, {
      proofId,
      leagueId,
    });

    await as(kai).mutation(api.challenges.vote, { challengeId, legit: true });
    await as(kai).mutation(api.challenges.vote, { challengeId, legit: false });

    const votes = await t.run((ctx) =>
      ctx.db
        .query("votes")
        .withIndex("by_challenge", (q) => q.eq("challengeId", challengeId))
        .collect(),
    );
    expect(votes.map(({ userId, legit }) => ({ userId, legit }))).toEqual([
      { userId: kai, legit: false },
    ]);
    // Kai voting twice is still one of two eligible voters, so the vote stays open.
    expect((await challenge(challengeId))?.status).toBe("open");
  });

  it("rejects a second challenge on the same proof, even after the first is decided", async () => {
    const { t, as, sam, kai, leagueId, proofId } = await setup();
    await as(sam).mutation(api.challenges.open, { proofId, leagueId });

    await expect(
      as(kai).mutation(api.challenges.open, { proofId, leagueId }),
    ).rejects.toThrow("already been challenged");

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      as(kai).mutation(api.challenges.open, { proofId, leagueId }),
    ).rejects.toThrow("already been challenged");
  });

  it("does not let the proof's owner or the challenger vote", async () => {
    const { as, maya, sam, leagueId, proofId } = await setup();
    const challengeId = await as(sam).mutation(api.challenges.open, {
      proofId,
      leagueId,
    });

    await expect(
      as(maya).mutation(api.challenges.vote, { challengeId, legit: true }),
    ).rejects.toThrow("two sides");
    await expect(
      as(sam).mutation(api.challenges.vote, { challengeId, legit: false }),
    ).rejects.toThrow("two sides");
  });

  it("does not let someone outside the league challenge or vote", async () => {
    const { as, sam, olu, leagueId, proofId } = await setup();

    await expect(
      as(olu).mutation(api.challenges.open, { proofId, leagueId }),
    ).rejects.toThrow("Only members of this league");
    const challengeId = await as(sam).mutation(api.challenges.open, {
      proofId,
      leagueId,
    });
    await expect(
      as(olu).mutation(api.challenges.vote, { challengeId, legit: false }),
    ).rejects.toThrow("Only members of this league");
  });

  it("does not let a player challenge their own proof", async () => {
    const { as, maya, leagueId, proofId } = await setup();

    await expect(
      as(maya).mutation(api.challenges.open, { proofId, leagueId }),
    ).rejects.toThrow("your own proof");
  });

  it("rejects a challenge more than 24 hours after the proof", async () => {
    const { as, taskStatus, sam, leagueId, proofId } = await setup({
      proofAgeMs: CHALLENGE_WINDOW_MS + 1,
    });

    await expect(
      as(sam).mutation(api.challenges.open, { proofId, leagueId }),
    ).rejects.toThrow("within 24 hours");
    expect(await taskStatus()).toBe("verified");
  });

  it("rejects a vote after the vote has closed", async () => {
    const { t, as, sam, kai, leagueId, proofId } = await setup();
    const challengeId = await as(sam).mutation(api.challenges.open, {
      proofId,
      leagueId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await expect(
      as(kai).mutation(api.challenges.vote, { challengeId, legit: false }),
    ).rejects.toThrow("has closed");
  });

  it("sums each challenger's points for the challenges decided in a time range", async () => {
    const { t, as, challenge, sam, kai, noor, leagueId, proofId } =
      await setup();
    const challengeId = await as(sam).mutation(api.challenges.open, {
      proofId,
      leagueId,
    });
    const pointsIn = (from: number, to: number) =>
      t.run(async (ctx) => [
        ...(await challengerPointsByUser(ctx, leagueId, { from, to })),
      ]);

    // An open challenge is worth nothing yet.
    expect(await pointsIn(0, Number.MAX_SAFE_INTEGER)).toEqual([]);

    await as(kai).mutation(api.challenges.vote, { challengeId, legit: false });
    await as(noor).mutation(api.challenges.vote, { challengeId, legit: false });
    const decidedAt = (await challenge(challengeId))!.closesAt;

    expect(await pointsIn(decidedAt, decidedAt + 1)).toEqual([
      [sam, CHALLENGER_STAKE],
    ]);
    // The range is half-open: a challenge decided exactly at "to" belongs to the next range.
    expect(await pointsIn(decidedAt - 1_000, decidedAt)).toEqual([]);
    expect(await pointsIn(decidedAt + 1, decidedAt + 1_000)).toEqual([]);
  });
});
