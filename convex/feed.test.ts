// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { canVoteOn, feedKind, isCloseCall, isReactionEmoji, summariseReactions, tallyVotes } from "./feed";

const modules = import.meta.glob("./**/*.ts");

describe("isCloseCall", () => {
  it("flags a pass the referee was unsure about", () => {
    expect(isCloseCall({ pass: true, confidence: 0.6 })).toBe(true);
    expect(isCloseCall({ pass: true, confidence: 0.75 })).toBe(true);
  });
  it("does not flag a confident pass or a fail", () => {
    expect(isCloseCall({ pass: true, confidence: 0.76 })).toBe(false);
    expect(isCloseCall({ pass: true, confidence: 0.98 })).toBe(false);
    expect(isCloseCall({ pass: false, confidence: 0.4 })).toBe(false);
  });
});

describe("feedKind", () => {
  it("maps where a task came from to how the feed labels it", () => {
    expect(feedKind("draft")).toBe("proof");
    expect(feedKind("flex")).toBe("proof");
    expect(feedKind("drop")).toBe("drop");
    expect(feedKind("group")).toBe("group");
  });
});

describe("summariseReactions", () => {
  it("counts per emoji, most used first, and marks the viewer's own", () => {
    const reactions = [
      { userId: "maya", emoji: "🔥" },
      { userId: "sam", emoji: "💪" },
      { userId: "me", emoji: "💪" },
      { userId: "lee", emoji: "👀" },
    ];
    expect(summariseReactions(reactions, "me")).toEqual([
      { emoji: "💪", count: 2, mine: true },
      { emoji: "🔥", count: 1, mine: false },
      { emoji: "👀", count: 1, mine: false },
    ]);
  });
  it("is empty when nobody has reacted", () => {
    expect(summariseReactions([], "me")).toEqual([]);
  });
});

describe("tallyVotes", () => {
  it("splits legit from not legit and reports the viewer's vote", () => {
    const votes = [
      { userId: "maya", legit: true },
      { userId: "sam", legit: false },
      { userId: "me", legit: false },
    ];
    expect(tallyVotes(votes, "me")).toEqual({ legit: 1, notLegit: 2, myVote: false });
  });
  it("leaves myVote out when the viewer has not voted", () => {
    expect(tallyVotes([{ userId: "maya", legit: true }], "me")).toEqual({ legit: 1, notLegit: 0 });
  });
});

describe("canVoteOn", () => {
  const challenge = { status: "open", leagueId: "yc", challengerId: "sam" } as const;
  it("lets the rest of the league vote", () => {
    expect(canVoteOn(challenge, { userId: "lee", leagueId: "yc" }, "maya")).toBe(true);
  });
  it("keeps the proof's owner and the challenger out of the vote", () => {
    expect(canVoteOn(challenge, { userId: "maya", leagueId: "yc" }, "maya")).toBe(false);
    expect(canVoteOn(challenge, { userId: "sam", leagueId: "yc" }, "maya")).toBe(false);
  });
  it("is closed to other leagues and once the challenge is decided", () => {
    expect(canVoteOn(challenge, { userId: "lee", leagueId: "other" }, "maya")).toBe(false);
    expect(canVoteOn({ ...challenge, status: "upheld" }, { userId: "lee", leagueId: "yc" }, "maya")).toBe(false);
  });
});

describe("isReactionEmoji", () => {
  it("accepts single and joined emoji", () => {
    expect(isReactionEmoji("🔥")).toBe(true);
    expect(isReactionEmoji("👨‍👩‍👧‍👦")).toBe(true);
  });
  it("rejects empty strings and sentences", () => {
    expect(isReactionEmoji("")).toBe(false);
    expect(isReactionEmoji("nice one")).toBe(false);
    expect(isReactionEmoji("x".repeat(17))).toBe(false);
  });
});

describe("feed.list and feed.react", () => {
  const NOW = Date.UTC(2026, 10, 15, 20);
  const WEEK = Date.UTC(2026, 10, 9, 8);

  /**
   * League "YC" has Maya, Sam and Lee; Olu is in no league. Maya has a fresh close-call proof with
   * a photo, Sam an older confident one and a failed attempt, and Lee answered a drop that belongs
   * to a different league.
   */
  async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const [maya, sam, lee, olu] = await Promise.all(
        ["Maya", "Sam", "Lee", "Olu"].map((name) => ctx.db.insert("users", { name })),
      );
      const league = (name: string) =>
        ctx.db.insert("leagues", {
          name, inviteCode: name, stakeUsd: 5, visibility: "private", maxMembers: 8, createdBy: maya,
        });
      const [leagueId, otherLeagueId] = [await league("YC"), await league("Other")];
      for (const userId of [maya, sam, lee]) {
        await ctx.db.insert("memberships", { leagueId, userId, paid: true, joinedAt: NOW });
      }
      await ctx.db.insert("memberships", { leagueId: otherLeagueId, userId: lee, paid: true, joinedAt: NOW });

      const prove = async (
        userId: Id<"users">,
        title: string,
        proof: { pass: boolean; confidence: number; createdAt: number; storageId?: Id<"_storage"> },
        dropId?: Id<"drops">,
      ) => {
        const taskId = await ctx.db.insert("tasks", {
          userId, weekStart: WEEK, slot: "body", title, points: 40, proofType: "photo",
          status: proof.pass ? "verified" : "open", source: dropId ? "drop" : "draft",
          ...(dropId ? { dropId } : {}),
        });
        return await ctx.db.insert("proofs", {
          taskId, userId, weekStart: WEEK, mediaType: "photo", reason: `Referee on ${title}`,
          highlight: 6, caption: title, via: "app", ...proof,
        });
      };
      const photo = await ctx.storage.store(new Blob(["photo"]));
      const mayaProof = await prove(maya, "Leg day", { pass: true, confidence: 0.7, createdAt: NOW - 1_000, storageId: photo });
      const samProof = await prove(sam, "5k run", { pass: true, confidence: 0.95, createdAt: NOW - 60_000 });
      await prove(sam, "Wrong photo", { pass: false, confidence: 0.2, createdAt: NOW - 500 });
      const otherDrop = await ctx.db.insert("drops", {
        leagueId: otherLeagueId, kind: "quicktime", title: "20 push-ups", slot: "body", points: 40,
        opensAt: NOW - 120_000, closesAt: NOW, status: "open",
      });
      await prove(lee, "20 push-ups", { pass: true, confidence: 0.9, createdAt: NOW - 100 }, otherDrop);
      return { maya, sam, lee, olu, leagueId, otherLeagueId, mayaProof, samProof };
    });
    // Convex Auth's getAuthUserId reads the user id from the part of the subject before "|".
    const as = (userId: Id<"users">) => t.withIdentity({ subject: userId + "|test-session" });
    return { t, as, ...ids };
  }

  it("lists the league's verified proofs, newest first, with the referee's reason", async () => {
    const { as, sam, leagueId, mayaProof, samProof } = await setup();
    const feed = await as(sam).query(api.feed.list, { leagueId });

    // Sam's failed attempt and Lee's answer to another league's drop are not part of this feed.
    expect(feed.map((item) => item.proofId)).toEqual([mayaProof, samProof]);
    expect(feed[0]).toMatchObject({
      kind: "proof",
      user: { name: "Maya" },
      taskTitle: "Leg day",
      slot: "body",
      points: 40,
      reason: "Referee on Leg day",
      mediaType: "photo",
      closeCall: true,
      reactions: [],
    });
    expect(feed[0].mediaUrl).toEqual(expect.any(String));
    expect(feed[1].closeCall).toBe(false);
    expect(feed[1].mediaUrl).toBeUndefined();
  });

  it("shows a drop's result only in the drop's league", async () => {
    const { as, lee, otherLeagueId } = await setup();
    const feed = await as(lee).query(api.feed.list, { leagueId: otherLeagueId });
    expect(feed.map((item) => [item.kind, item.taskTitle])).toEqual([["drop", "20 push-ups"]]);
  });

  it("is empty for someone outside the league", async () => {
    const { as, olu, leagueId } = await setup();
    expect(await as(olu).query(api.feed.list, { leagueId })).toEqual([]);
  });

  it("toggles a reaction and counts it for the whole league", async () => {
    const { as, sam, lee, leagueId, mayaProof } = await setup();
    await as(sam).mutation(api.feed.react, { proofId: mayaProof, emoji: "🔥" });
    await as(lee).mutation(api.feed.react, { proofId: mayaProof, emoji: "🔥" });
    await as(lee).mutation(api.feed.react, { proofId: mayaProof, emoji: "💪" });

    const [asSam] = await as(sam).query(api.feed.list, { leagueId });
    expect(asSam.reactions).toEqual([
      { emoji: "🔥", count: 2, mine: true },
      { emoji: "💪", count: 1, mine: false },
    ]);

    await as(sam).mutation(api.feed.react, { proofId: mayaProof, emoji: "🔥" });
    const [afterUndo] = await as(sam).query(api.feed.list, { leagueId });
    expect(afterUndo.reactions[0]).toEqual({ emoji: "🔥", count: 1, mine: false });
  });

  it("only lets league-mates react", async () => {
    const { as, olu, mayaProof } = await setup();
    await expect(as(olu).mutation(api.feed.react, { proofId: mayaProof, emoji: "🔥" })).rejects.toThrow(
      "You can only react to proofs in your leagues.",
    );
  });

  it("carries the challenge state, the tally and who may vote", async () => {
    const { t, as, maya, sam, lee, leagueId, mayaProof } = await setup();
    const challengeId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("challenges", {
        proofId: mayaProof, leagueId, challengerId: sam, status: "open", closesAt: NOW + 3_600_000,
      });
      await ctx.db.insert("votes", { challengeId: id, userId: lee, legit: false });
      return id;
    });

    const [asLee] = await as(lee).query(api.feed.list, { leagueId });
    expect(asLee.challenge).toEqual({
      challengeId, status: "open", legit: 0, notLegit: 1, myVote: false, canVote: true, closesAt: NOW + 3_600_000,
    });
    // The two parties see the vote but take no part in it.
    for (const party of [maya, sam]) {
      const [item] = await as(party).query(api.feed.list, { leagueId });
      expect(item.challenge).toMatchObject({ canVote: false, notLegit: 1 });
      expect(item.challenge?.myVote).toBeUndefined();
    }
  });
});
