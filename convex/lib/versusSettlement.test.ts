import { describe, expect, it } from "vitest";

import { settlementLedgerRows } from "./settlement";
import { computeVersusSettlement } from "./versusSettlement";

const sam = (points: number, finished = false, paid = true) => ({
  userId: "sam",
  paid,
  finished,
  points,
});
const maya = (points: number, finished = false, paid = true) => ({
  userId: "maya",
  paid,
  finished,
  points,
});

describe("computeVersusSettlement", () => {
  it("gives the winner both stakes less 10% of the loser's", () => {
    const settlement = computeVersusSettlement(20, [sam(300), maya(250)]);
    expect(settlement).toEqual({
      potCents: 4000,
      feeCents: 200,
      payouts: [{ userId: "sam", refundCents: 2000, winningsCents: 1800 }],
    });
    const total = settlementLedgerRows("w1", settlement).reduce(
      (sum, row) => sum + row.amountUsd,
      0,
    );
    expect(total).toBe(40);
  });

  it("lets the winner win without clearing all five", () => {
    expect(computeVersusSettlement(5, [sam(90), maya(120)]).payouts).toEqual([
      { userId: "maya", refundCents: 500, winningsCents: 450 },
    ]);
  });

  it("refunds a loser who cleared all five slots", () => {
    const settlement = computeVersusSettlement(20, [
      sam(400, true),
      maya(350, true),
    ]);
    expect(settlement.feeCents).toBe(0);
    expect(settlement.payouts).toEqual([
      { userId: "sam", refundCents: 2000, winningsCents: 0 },
      { userId: "maya", refundCents: 2000, winningsCents: 0 },
    ]);
  });

  it("refunds both on a tie", () => {
    expect(
      computeVersusSettlement(20, [sam(200), maya(200)]).payouts.map(
        (p) => p.refundCents,
      ),
    ).toEqual([2000, 2000]);
  });

  it("only refunds the one stake when the other player never paid", () => {
    expect(
      computeVersusSettlement(20, [sam(100), maya(300, false, false)]),
    ).toEqual({
      potCents: 2000,
      feeCents: 0,
      payouts: [{ userId: "sam", refundCents: 2000, winningsCents: 0 }],
    });
  });

  it("moves nothing in a free game or before the friend joins", () => {
    expect(computeVersusSettlement(0, [sam(100), maya(50)]).payouts).toEqual(
      [],
    );
    expect(computeVersusSettlement(20, [sam(100)]).payouts).toEqual([
      { userId: "sam", refundCents: 2000, winningsCents: 0 },
    ]);
  });
});
