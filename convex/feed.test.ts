import { describe, expect, it } from "vitest";
import { canVoteOn, feedKind, isCloseCall, isReactionEmoji, summariseReactions, tallyVotes } from "./feed";

describe("isCloseCall", () => {
  it("flags a pass the referee was unsure about", () => {
    expect(isCloseCall({ pass: true, confidence: 0.6 })).toBe(true);
    expect(isCloseCall({ pass: true, confidence: 0.74 })).toBe(true);
  });
  it("does not flag a confident pass or a fail", () => {
    expect(isCloseCall({ pass: true, confidence: 0.75 })).toBe(false);
    expect(isCloseCall({ pass: true, confidence: 0.98 })).toBe(false);
    expect(isCloseCall({ pass: false, confidence: 0.4 })).toBe(false);
  });
});

describe("feedKind", () => {
  it("maps where a task came from to how the feed labels it", () => {
    expect(feedKind("draft")).toBe("proof");
    expect(feedKind("flex")).toBe("proof");
    expect(feedKind("drop")).toBe("drop");
    expect(feedKind("mystery")).toBe("drop");
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
