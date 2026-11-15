import { describe, expect, it } from "vitest";

import type { Payout, Pot, Standing } from "./backend";
import { escrowFlowData, escrowMembers, escrowPayout, largestPayoutUsd, winnerTakesUsd } from "./escrow";

type UserId = Pot["paid"][number]["userId"];
const id = (value: string) => value as UserId;

const NOW = 1_000_000;
const person = (userId: string, name: string) => ({ userId: id(userId), name });
const payout = (userId: string, kind: Payout["kind"], amountUsd: number): Payout => ({ userId: id(userId), name: userId, kind, amountUsd });

const openPot: Pot = {
  stakeUsd: 20,
  potUsd: 60,
  paid: [person("u3", "Maya"), person("u1", "Sam"), person("u2", "Ana")],
  unpaid: [person("u4", "Bo")],
  settlesAt: NOW + 60_000,
};

describe("winnerTakesUsd", () => {
  it("is the winner's stake back plus the other stakes less the 10% fee", () => {
    expect(winnerTakesUsd(20, 120)).toBe(110);
    expect(winnerTakesUsd(5, 15)).toBe(14);
  });

  it("is the stake alone when only one member has paid", () => {
    expect(winnerTakesUsd(20, 20)).toBe(20);
  });

  it("is nothing while the pot is empty", () => {
    expect(winnerTakesUsd(20, 0)).toBe(0);
  });

  it("rounds to cents", () => {
    expect(winnerTakesUsd(5, 12.55)).toBe(11.8);
  });
});

describe("largestPayoutUsd", () => {
  it("adds a member's refund and winnings before comparing", () => {
    const payouts = [payout("a", "refund", 20), payout("a", "winnings", 54), payout("b", "refund", 20), payout("b", "winnings", 36)];
    expect(largestPayoutUsd(payouts)).toBe(74);
  });

  it("is nothing when nobody was paid", () => {
    expect(largestPayoutUsd([])).toBe(0);
  });
});

describe("escrowPayout", () => {
  it("shows the most a single finisher can take while the week is open", () => {
    expect(escrowPayout(openPot, NOW)).toEqual({ label: "Winner takes up to", amountUsd: 56 });
    expect(escrowPayout({ ...openPot, potUsd: 0 }, NOW)).toEqual({ label: "Winner takes up to", amountUsd: 0 });
  });

  it("shows the largest real payout once the week has settled, even before its scheduled end", () => {
    const settled = { ...openPot, payouts: [payout("u1", "refund", 20), payout("u1", "winnings", 36)] };
    expect(escrowPayout(settled, NOW)).toEqual({ label: "Paid out", amountUsd: 56 });
  });

  it("says nobody was paid rather than paying out $0", () => {
    expect(escrowPayout({ ...openPot, payouts: [] }, NOW)).toEqual({ label: "No payout" });
  });

  it("waits for the payouts when the clock has run out before the settlement has", () => {
    expect(escrowPayout({ ...openPot, settlesAt: NOW - 1 }, NOW)).toEqual({ label: "Settling up" });
  });
});

describe("escrowMembers", () => {
  const standings = [
    { userId: id("u1"), avatarUrl: "https://example.test/sam.jpg" },
    { userId: id("u4") },
  ] satisfies Pick<Standing, "userId" | "avatarUrl">[];

  it("lists paid and unpaid members in name order with their pictures", () => {
    expect(escrowMembers(openPot, standings)).toEqual([
      { userId: "u2", name: "Ana", paid: true },
      { userId: "u4", name: "Bo", paid: false },
      { userId: "u3", name: "Maya", paid: true },
      { userId: "u1", name: "Sam", paid: true, avatarUrl: "https://example.test/sam.jpg" },
    ]);
  });

  it("keeps every member in place when one of them pays", () => {
    const before = escrowMembers(openPot, standings).map((member) => member.userId);
    const afterBoPays = { paid: [...openPot.paid, person("u4", "Bo")], unpaid: [] };
    expect(escrowMembers(afterBoPays, standings).map((member) => member.userId)).toEqual(before);
  });
});

describe("escrowFlowData", () => {
  it("carries the stake and the pot through unchanged", () => {
    const data = escrowFlowData(openPot, [], NOW);
    expect(data).toMatchObject({ stakeUsd: 20, potUsd: 60, payout: { label: "Winner takes up to", amountUsd: 56 } });
    expect(data.members).toHaveLength(4);
  });
});
