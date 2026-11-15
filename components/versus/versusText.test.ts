import { describe, expect, it } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";

import type { Versus } from "./api";
import { inviteMessage, outcomeLine, potLine } from "./versusText";

const me = { userId: "me" as Id<"users">, name: "Ana", paid: true };
const them = "them" as Id<"users">;

describe("inviteMessage", () => {
  it("carries the code and the link", () => {
    expect(inviteMessage("ABC123", "lineup://versus/join?code=ABC123")).toBe(
      "I challenge you to a Lineup week. Code ABC123 lineup://versus/join?code=ABC123",
    );
  });
});

describe("potLine", () => {
  it("names the pot and the stake", () => {
    expect(potLine({ stakeUsd: 5, potUsd: 10 })).toBe("$10 pot, $5 each");
  });
  it("says what a free versus is for", () => {
    expect(potLine({ stakeUsd: 0, potUsd: 0 })).toBe("Free, for bragging rights");
  });
});

const base = {
  leagueId: "league" as Id<"leagues">,
  inviteCode: "ABC123",
  me,
  opponent: { userId: them, name: "Bo", paid: true },
  potUsd: 10,
  endsAt: 0,
};

function settled(stakeUsd: number, result: Extract<Versus, { status: "settled" }>["result"], opponent: Versus["opponent"] = base.opponent): Versus {
  return { ...base, opponent, stakeUsd, status: "settled", result };
}

describe("outcomeLine", () => {
  it("is null until settled", () => {
    expect(outcomeLine({ ...base, stakeUsd: 5, status: "live" })).toBeNull();
  });
  it("shows the winner's payout", () => {
    expect(outcomeLine(settled(20, { winnerId: me.userId, payouts: [{ userId: me.userId, name: "Ana", amountUsd: 36 }] }))).toEqual({
      title: "You won $36",
    });
  });
  it("names a refunded loser's stake", () => {
    expect(outcomeLine(settled(5, { winnerId: them, payouts: [{ userId: me.userId, name: "Ana", amountUsd: 5 }] }))).toEqual({
      title: "You lost",
      detail: "Full lineup: your $5 comes back",
    });
  });
  it("says the stake is gone when nothing comes back", () => {
    expect(outcomeLine(settled(5, { winnerId: them, payouts: [{ userId: them, name: "Bo", amountUsd: 9 }] }))).toEqual({
      title: "You lost",
      detail: "Your $5 stake is gone",
    });
  });
  it("reads a tie", () => {
    expect(outcomeLine(settled(5, { winnerId: null, payouts: [{ userId: me.userId, name: "Ana", amountUsd: 5 }] }))).toEqual({
      title: "It's a tie",
      detail: "$5 back to you",
    });
  });
  it("says nobody accepted an untaken invite", () => {
    const empty = { winnerId: null, payouts: [] };
    expect(outcomeLine(settled(5, empty, null))).toEqual({ title: "Nobody accepted", detail: "Your stake came back" });
    expect(outcomeLine(settled(0, empty, null))).toEqual({ title: "Nobody accepted" });
  });
  it("keeps a free win free of amounts", () => {
    expect(outcomeLine(settled(0, { winnerId: me.userId, payouts: [] }))).toEqual({ title: "You won" });
  });
});
