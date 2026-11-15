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
  test("finishers get their stake back plus 90% of forfeited stakes by points", () => {
    const settlement = computeSettlement(20, [
      member("maya", { finished: true, points: 300 }),
      member("sam", { finished: true, points: 100 }),
      member("ana"),
      member("leo"),
      member("kai"),
      member("zoe"),
    ]);

    // Four non-finishers forfeit $80: $8 fee, $72 split 3:1.
    expect(settlement).toEqual({
      potCents: 12000,
      feeCents: 800,
      payouts: [
        { userId: "maya", refundCents: 2000, winningsCents: 5400 },
        { userId: "sam", refundCents: 2000, winningsCents: 1800 },
      ],
    });
    expect(paidOutCents(settlement) + settlement.feeCents).toBe(settlement.potCents);
  });

  test("with no finishers every stake is refunded and no fee is taken", () => {
    const settlement = computeSettlement(5, [member("maya", { points: 90 }), member("sam")]);

    expect(settlement).toEqual({
      potCents: 1000,
      feeCents: 0,
      payouts: [
        { userId: "maya", refundCents: 500, winningsCents: 0 },
        { userId: "sam", refundCents: 500, winningsCents: 0 },
      ],
    });
  });

  test("when everyone finishes there is nothing to win and nothing to charge", () => {
    const settlement = computeSettlement(5, [
      member("maya", { finished: true, points: 200 }),
      member("sam", { finished: true, points: 50 }),
    ]);

    expect(settlement.feeCents).toBe(0);
    expect(settlement.payouts).toEqual([
      { userId: "maya", refundCents: 500, winningsCents: 0 },
      { userId: "sam", refundCents: 500, winningsCents: 0 },
    ]);
  });

  test("a free league moves no money", () => {
    const settlement = computeSettlement(0, [
      member("maya", { finished: true, points: 200 }),
      member("sam"),
    ]);

    expect(settlement).toEqual({ potCents: 0, feeCents: 0, payouts: [] });
  });

  test("an unpaid member neither wins nor forfeits, even with the top score", () => {
    const settlement = computeSettlement(5, [
      member("freeloader", { paid: false, finished: true, points: 999 }),
      member("maya", { finished: true, points: 10 }),
      member("sam"),
      member("unpaid-quitter", { paid: false }),
    ]);

    // Only Sam's $5 is forfeited: 50c fee, $4.50 to Maya.
    expect(settlement).toEqual({
      potCents: 1000,
      feeCents: 50,
      payouts: [{ userId: "maya", refundCents: 500, winningsCents: 450 }],
    });
  });

  test("finishers with no points between them split the winnings evenly", () => {
    const settlement = computeSettlement(5, [
      member("maya", { finished: true }),
      member("sam", { finished: true }),
      member("ana"),
      member("leo"),
    ]);

    expect(settlement.payouts.map((p) => p.winningsCents)).toEqual([450, 450]);
  });

  test("uneven shares are rounded without creating or losing a cent", () => {
    const settlement = computeSettlement(5, [
      member("maya", { finished: true, points: 1 }),
      member("sam", { finished: true, points: 1 }),
      member("ana", { finished: true, points: 1 }),
      member("leo"),
    ]);

    // $4.50 three ways is exactly 150c each; make it awkward with a 7-way split too.
    expect(settlement.payouts.map((p) => p.winningsCents)).toEqual([150, 150, 150]);
    expect(splitByWeight(100, [1, 1, 1, 1, 1, 1, 1])).toEqual([15, 15, 14, 14, 14, 14, 14]);
  });

  test("the rows always sum to the pot, whatever the league looks like", () => {
    // Deterministic pseudo-random leagues: no seed library, same cases every run.
    let seed = 42;
    const next = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };

    for (let round = 0; round < 500; round++) {
      const stakeUsd = [0, 5, 20, 7.5, 0.01][next(5)];
      const entrants = Array.from({ length: next(12) }, (_, i) =>
        member(`user${i}`, {
          paid: next(4) > 0,
          finished: next(2) === 0,
          points: next(600) - 50,
        }),
      );
      const settlement = computeSettlement(stakeUsd, entrants);

      expect(paidOutCents(settlement) + settlement.feeCents).toBe(settlement.potCents);
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
  test("writes refund, winnings and fee rows that sum to the pot", () => {
    const settlement = computeSettlement(20, [
      member("maya", { finished: true, points: 300 }),
      member("sam", { finished: true, points: 100 }),
      member("ana"),
      member("leo"),
    ]);
    const rows = settlementLedgerRows("week1", settlement);

    expect(rows).toEqual([
      { userId: "maya", kind: "refund", amountUsd: 20, idempotencyKey: "week1:maya:refund" },
      { userId: "maya", kind: "winnings", amountUsd: 27, idempotencyKey: "week1:maya:winnings" },
      { userId: "sam", kind: "refund", amountUsd: 20, idempotencyKey: "week1:sam:refund" },
      { userId: "sam", kind: "winnings", amountUsd: 9, idempotencyKey: "week1:sam:winnings" },
      { kind: "fee", amountUsd: 4, idempotencyKey: "week1:fee" },
    ]);
    expect(rows.reduce((sum, row) => sum + row.amountUsd, 0)).toBe(80);
  });

  test("leaves out zero rows: no winnings without forfeits, no fee without finishers", () => {
    const allRefunded = computeSettlement(5, [member("maya"), member("sam")]);

    expect(settlementLedgerRows("week1", allRefunded).map((row) => row.kind)).toEqual([
      "refund",
      "refund",
    ]);
    expect(settlementLedgerRows("week1", computeSettlement(0, [member("maya")]))).toEqual([]);
  });

  test("keys are unique per row, so a second write can be recognised", () => {
    const settlement = computeSettlement(5, [
      member("maya", { finished: true, points: 10 }),
      member("sam"),
    ]);
    const keys = settlementLedgerRows("week1", settlement).map((row) => row.idempotencyKey);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
