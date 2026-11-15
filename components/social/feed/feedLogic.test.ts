import { describe, expect, it } from "vitest";

import type { FeedItem } from "@/components/social/contract";

import {
  canChallenge,
  challengeStatus,
  legitShare,
  proofShareText,
  reactionButtons,
  REACTION_EMOJI,
  timeAgo,
  timeLeft,
} from "./feedLogic";

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

const maya = "user_maya" as FeedItem["user"]["_id"];
const proof = (over: Partial<Pick<FeedItem, "challenge" | "createdAt">> = {}) => ({
  user: { _id: maya, name: "Maya" },
  createdAt: NOW - HOUR,
  ...over,
});
const challenge = (status: "open" | "upheld" | "overturned") => ({
  challengeId: "challenge_1" as NonNullable<FeedItem["challenge"]>["challengeId"],
  status,
  legit: 0,
  notLegit: 0,
  canVote: status === "open",
  closesAt: NOW + 12 * HOUR,
});

describe("reactionButtons", () => {
  it("offers every emoji with a zero count when nobody has reacted", () => {
    expect(reactionButtons([])).toEqual(REACTION_EMOJI.map((emoji) => ({ emoji, count: 0, mine: false })));
  });

  it("keeps the offered order whatever order the server sends, and appends other emoji", () => {
    const buttons = reactionButtons([
      { emoji: "🤯", count: 5, mine: false },
      { emoji: REACTION_EMOJI[2], count: 3, mine: true },
    ]);
    expect(buttons.map((button) => button.emoji)).toEqual([...REACTION_EMOJI, "🤯"]);
    expect(buttons[2]).toEqual({ emoji: REACTION_EMOJI[2], count: 3, mine: true });
  });
});

describe("canChallenge", () => {
  it("lets another member challenge a fresh proof", () => {
    expect(canChallenge(proof(), "user_sam", NOW, 3)).toBe(true);
  });

  it("refuses your own proof, a second challenge, and a proof older than a day", () => {
    expect(canChallenge(proof(), maya, NOW, 6)).toBe(false);
    expect(canChallenge(proof({ challenge: challenge("upheld") }), "user_sam", NOW, 6)).toBe(false);
    expect(canChallenge(proof({ createdAt: NOW - 25 * HOUR }), "user_sam", NOW, 6)).toBe(false);
  });

  it("waits until we know who is looking", () => {
    expect(canChallenge(proof(), undefined, NOW, 6)).toBe(false);
  });

  it("needs a third member to vote, and waits for the member count", () => {
    expect(canChallenge(proof(), "user_sam", NOW, 2)).toBe(false);
    expect(canChallenge(proof(), "user_sam", NOW, 1)).toBe(false);
    expect(canChallenge(proof(), "user_sam", NOW, undefined)).toBe(false);
  });
});

describe("legitShare", () => {
  it("splits the bar by votes and stays even with none", () => {
    expect(legitShare(3, 1)).toBe(0.75);
    expect(legitShare(0, 2)).toBe(0);
    expect(legitShare(0, 0)).toBe(0.5);
  });
});

describe("timeAgo and timeLeft", () => {
  it("formats ages compactly", () => {
    expect(timeAgo(NOW - 20_000, NOW)).toBe("now");
    expect(timeAgo(NOW - 5 * 60_000, NOW)).toBe("5m");
    expect(timeAgo(NOW - 3 * HOUR, NOW)).toBe("3h");
    expect(timeAgo(NOW - 50 * HOUR, NOW)).toBe("2d");
    expect(timeAgo(NOW + 5_000, NOW)).toBe("now");
  });

  it("counts a vote down and says closing once the deadline has passed", () => {
    expect(timeLeft(NOW + 12 * HOUR, NOW)).toBe("12h left");
    expect(timeLeft(NOW + 12 * HOUR + 5_000, NOW)).toBe("12h left");
    expect(timeLeft(NOW + 1.4 * HOUR, NOW)).toBe("1h left");
    expect(timeLeft(NOW + 25 * 60_000, NOW)).toBe("25m left");
    expect(timeLeft(NOW - 1, NOW)).toBe("closing");
  });
});

describe("challengeStatus", () => {
  it("says what happened to the points", () => {
    expect(challengeStatus(challenge("open"), NOW)).toBe("Points on hold · 12h left");
    expect(challengeStatus(challenge("upheld"), NOW)).toBe("Upheld · points stand");
    expect(challengeStatus(challenge("overturned"), NOW)).toBe("Overturned · task reopened");
  });
});

describe("proofShareText", () => {
  const item = { user: { _id: maya, name: "Maya" }, taskTitle: "Run 5k", points: 12, mediaType: "photo" as const };

  it("names the player, the task and the points", () => {
    expect(proofShareText(item)).toBe('Maya proved "Run 5k" for 12 pts on Lineup.');
  });

  it("adds the photo link when there is one, but not for a Canvas proof", () => {
    expect(proofShareText({ ...item, mediaUrl: "https://x/p.jpg" })).toBe(
      'Maya proved "Run 5k" for 12 pts on Lineup.\nhttps://x/p.jpg',
    );
    expect(proofShareText({ ...item, mediaUrl: "https://x/c", mediaType: "canvas" })).not.toContain("https");
  });
});
