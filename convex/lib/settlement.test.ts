import { describe, expect, test } from "vitest";
import {
  computeSettlement,
  settlementLedgerRows,
  splitByWeight,
  type Entrant,
  type Settlement,
} from "./settlement";

const member = (userId: string, overrides: Partial<Entrant<string>> = {}): Entrant<string> => ({
  userId,
  paid: true,
  finished: false,
  points: 0,
  ...overrides,
});

const paidOutCents = (settlement: Settlement<string>) =>
  settlement.payouts.reduce((sum, p) => sum + p.refundCents + p.winningsCents, 0);

describe("computeSettlement", () => {
  test("everyone clearing all five splits the pot evenly", () => {
    const settlement = computeSettlement(20, [
      member("maya", { slotsCleared: 5, points: 300 }),
      member("sam", { slotsCleared: 5, points: 100 }),
      member("ana", { slotsCleared: 5 }),
    ]);

    expect(settlement.potCents).toBe(6000);
    expect(settlement.feeCents).toBe(0);
    expect(settlement.payouts).toEqual([
      { userId: "maya", refundCents: 0, winningsCents: 2000 },
      { userId: "sam", refundCents: 0, winningsCents: 2000 },
      { userId: "ana", refundCents: 0, winningsCents: 2000 },
    ]);
  });

  test("the members tied for the most slots split it, even short of five, whatever their points", () => {
    const settlement = computeSettlement(20, [
      member("maya", { slotsCleared: 4, points: 50 }),
      member("sam", { slotsCleared: 4, points: 400 }),
      member("ana", { slotsCleared: 3, points: 900 }),
      member("leo", { slotsCleared: 0 }),
    ]);

    expect(settlement.payouts).toEqual([
      { userId: "maya", refundCents: 0, winningsCents: 4000 },
      { userId: "sam", refundCents: 0, winningsCents: 4000 },
    ]);
  });

  test("an unpaid member shares nothing, even with the most slots", () => {
    const settlement = computeSettlement(5, [
      member("maya", { slotsCleared: 2 }),
      member("leo", { paid: false, slotsCleared: 5, points: 900 }),
    ]);

    expect(settlement.potCents).toBe(500);
    expect(settlement.payouts).toEqual([{ userId: "maya", refundCents: 0, winningsCents: 500 }]);
  });

  test("with no slot cleared by a paid member, the whole pot rolls over", () => {
    const settlement = computeSettlement(5, [member("maya"), member("sam"), member("leo", { paid: false, slotsCleared: 5 })]);

    expect(settlement).toEqual({ potCents: 1000, feeCents: 0, payouts: [], rolloverCents: 1000 });
  });

  test("a pot rolled over from earlier weeks joins the split when someone wins", () => {
    const settlement = computeSettlement(5, [member("maya", { slotsCleared: 1 }), member("sam")], 1000);

    expect(settlement.payouts).toEqual([{ userId: "maya", refundCents: 0, winningsCents: 2000 }]);
    expect(settlement.carriedInCents).toBe(1000);
  });

  test("left out, slotsCleared counts five for a finisher and none for anyone else", () => {
    const settlement = computeSettlement(5, [member("maya", { finished: true }), member("sam")]);

    expect(settlement.payouts).toEqual([{ userId: "maya", refundCents: 0, winningsCents: 1000 }]);
  });

  test("a free league moves no money", () => {
    expect(computeSettlement(0, [member("maya", { slotsCleared: 5 })])).toEqual({ potCents: 0, feeCents: 0, payouts: [] });
  });

  test("uneven shares are rounded without creating or losing a cent", () => {
    const settlement = computeSettlement(5, [
      member("maya", { slotsCleared: 5 }),
      member("sam", { slotsCleared: 5 }),
      member("ana", { slotsCleared: 5 }),
      member("leo", { slotsCleared: 1 }),
    ]);

    // $20 three ways: 667c, 667c and 666c.
    expect(settlement.payouts.map((p) => p.winningsCents)).toEqual([667, 667, 666]);
    expect(splitByWeight(100, [1, 1, 1, 1, 1, 1, 1])).toEqual([15, 15, 14, 14, 14, 14, 14]);
  });

  test("shares and rollovers always sum to the pot, whatever the league looks like", () => {
    // Deterministic pseudo-random leagues: no seed library, same cases every run.
    let seed = 42;
    const next = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };

    for (let round = 0; round < 500; round++) {
      const stakeUsd = [0, 5, 20, 7.5, 0.01][next(5)];
      const carriedInCents = [0, 0, 1000][next(3)];
      const entrants = Array.from({ length: next(12) }, (_, i) =>
        member(`user${i}`, { paid: next(4) > 0, slotsCleared: next(6), points: next(600) - 50 }),
      );
      const settlement = computeSettlement(stakeUsd, entrants, carriedInCents);

      const won = paidOutCents(settlement) + settlement.feeCents;
      if (settlement.payouts.length > 0) expect(won).toBe(settlement.potCents + carriedInCents);
      else expect(settlement.rolloverCents ?? 0).toBe(settlement.potCents);
      for (const payout of settlement.payouts) {
        expect(Number.isInteger(payout.winningsCents)).toBe(true);
        expect(payout.winningsCents).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("splitByWeight", () => {
  test("gives leftover cents to the largest fractions, earliest first on a tie", () => {
    expect(splitByWeight(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(splitByWeight(100, [2, 1])).toEqual([67, 33]);
  });

  test("ignores negative weights instead of paying a negative share", () => {
    expect(splitByWeight(100, [-20, 50, 50])).toEqual([0, 50, 50]);
  });
});

describe("settlementLedgerRows", () => {
  test("writes one winnings row per top performer, their escrow credit, summing to the pot", () => {
    const settlement = computeSettlement(20, [
      member("maya", { slotsCleared: 5 }),
      member("sam", { slotsCleared: 5 }),
      member("ana", { slotsCleared: 2 }),
      member("leo"),
    ]);
    const rows = settlementLedgerRows("week1", settlement);

    expect(rows).toEqual([
      { userId: "maya", kind: "winnings", amountUsd: 40, idempotencyKey: "week1:maya:winnings" },
      { userId: "sam", kind: "winnings", amountUsd: 40, idempotencyKey: "week1:sam:winnings" },
    ]);
    expect(rows.reduce((sum, row) => sum + row.amountUsd, 0)).toBe(80);
  });

  test("writes a rollover row for a pot nobody won, and a negative one when it is won later", () => {
    expect(settlementLedgerRows("week1", computeSettlement(5, [member("maya"), member("sam")]))).toEqual([
      { kind: "rollover", amountUsd: 10, idempotencyKey: "week1:rollover" },
    ]);
    expect(settlementLedgerRows("week2", computeSettlement(5, [member("maya", { slotsCleared: 1 })], 1000))).toEqual([
      { userId: "maya", kind: "winnings", amountUsd: 15, idempotencyKey: "week2:maya:winnings" },
      { kind: "rollover", amountUsd: -10, idempotencyKey: "week2:rollover-in" },
    ]);
    expect(settlementLedgerRows("week1", computeSettlement(0, [member("maya")]))).toEqual([]);
  });

  test("keys are unique per row, so a second write can be recognised", () => {
    const settlement = computeSettlement(5, [member("maya", { slotsCleared: 3 }), member("sam", { slotsCleared: 3 })], 500);
    const keys = settlementLedgerRows("week1", settlement).map((row) => row.idempotencyKey);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
