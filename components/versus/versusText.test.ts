import { describe, expect, it } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";

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

describe("outcomeLine", () => {
  it("is null until settled", () => {
    expect(outcomeLine({ me, stakeUsd: 5 })).toBeNull();
  });
  it("shows the winner's payout", () => {
    const result = { winnerId: me.userId, payouts: [{ userId: me.userId, name: "Ana", amountUsd: 36 }] };
    expect(outcomeLine({ me, stakeUsd: 20, result })).toEqual({ title: "You won $36" });
  });
  it("names a refunded loser's stake", () => {
    const result = { winnerId: them, payouts: [{ userId: me.userId, name: "Ana", amountUsd: 5 }] };
    expect(outcomeLine({ me, stakeUsd: 5, result })).toEqual({ title: "You lost", detail: "Full lineup: your $5 comes back" });
  });
  it("says the stake is gone when nothing comes back", () => {
    const result = { winnerId: them, payouts: [{ userId: them, name: "Bo", amountUsd: 9 }] };
    expect(outcomeLine({ me, stakeUsd: 5, result })).toEqual({ title: "You lost", detail: "Your $5 stake is gone" });
  });
  it("reads a tie", () => {
    const result = { winnerId: null, payouts: [{ userId: me.userId, name: "Ana", amountUsd: 5 }] };
    expect(outcomeLine({ me, stakeUsd: 5, result })).toEqual({ title: "It's a tie", detail: "$5 back to you" });
  });
  it("keeps a free win free of amounts", () => {
    const result = { winnerId: me.userId, payouts: [] };
    expect(outcomeLine({ me, stakeUsd: 0, result })).toEqual({ title: "You won" });
  });
});
