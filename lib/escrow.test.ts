import { describe, expect, it } from "vitest";

import type { Payout, Pot, Standing } from "./backend";
import { escrowFlowData, escrowMembers, escrowPayout, shareEachUsd } from "./escrow";

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

describe("shareEachUsd", () => {
  it("is the share each top finisher was credited", () => {
    expect(shareEachUsd([payout("a", "winnings", 20), payout("b", "winnings", 20)])).toBe(20);
  });

  it("is nothing when nobody won", () => {
    expect(shareEachUsd([])).toBe(0);
  });
});

describe("escrowPayout", () => {
  it("names the split while the week is open, leaving the figure to the pot", () => {
    expect(escrowPayout(openPot, NOW)).toEqual({ label: "Split among top finishers" });
  });

  it("shows each share in escrow once the week has settled, even before its scheduled end", () => {
    const settled = { ...openPot, payouts: [payout("u1", "winnings", 30), payout("u2", "winnings", 30)] };
    expect(escrowPayout(settled, NOW)).toEqual({ label: "In escrow: $30 each" });
  });

  it("says the pot rolls over when nobody won it", () => {
    expect(escrowPayout({ ...openPot, payouts: [] }, NOW)).toEqual({ label: "Rolls into next week" });
  });

  it("waits for the settlement when the clock has run out before it", () => {
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
    expect(data).toMatchObject({ stakeUsd: 20, potUsd: 60, payout: { label: "Split among top finishers" } });
    expect(data.members).toHaveLength(4);
  });
});
