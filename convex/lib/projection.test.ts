import { describe, expect, test } from "vitest";
import {
  finishProbability,
  projectionLabel,
  projectPayout,
  type Projection,
  type ProjectionMember,
} from "./projection";
import { computeSettlement } from "./settlement";

const member = (
  userId: string,
  overrides: Partial<ProjectionMember<string>> = {},
): ProjectionMember<string> => ({ userId, paid: true, points: 0, slotsCleared: 0, ...overrides });

const finisher = (userId: string, points: number) => member(userId, { points, slotsCleared: 5 });

describe("projectPayout eligibility", () => {
  test("a free league has nothing to win", () => {
    const projection = projectPayout({
      stakeUsd: 0,
      members: [member("maya"), member("sam")],
      userId: "maya",
      daysLeft: 3,
    });
    expect(projection).toEqual({
      eligible: false,
      stakeCents: 0,
      ifEndedNowCents: 0,
      expectedCents: 0,
      lowCents: 0,
      highCents: 0,
      finishProbability: 0,
    });
  });

  test("an unpaid member has nothing to win but the stake is still reported", () => {
    const projection = projectPayout({
      stakeUsd: 10,
      members: [member("maya"), member("sam", { paid: false })],
      userId: "sam",
      daysLeft: 3,
    });
    expect(projection.eligible).toBe(false);
    expect(projection.stakeCents).toBe(1000);
    expect(projection.expectedCents).toBe(0);
    expect(projection.highCents).toBe(0);
  });

  test("a user outside the league is not eligible", () => {
    const projection = projectPayout({
      stakeUsd: 10,
      members: [member("maya")],
      userId: "stranger",
      daysLeft: 3,
    });
    expect(projection.eligible).toBe(false);
    expect(projection.expectedCents).toBe(0);
  });
});

describe("projectPayout when the week is decided", () => {
  const league = [
    finisher("maya", 300),
    finisher("sam", 100),
    member("ana", { points: 80, slotsCleared: 3 }),
    member("leo", { points: 20, slotsCleared: 1 }),
  ];

  test("no time left collapses every figure onto the settlement as it stands", () => {
    const settled = computeSettlement(
      20,
      league.map((m) => ({ userId: m.userId, paid: m.paid, finished: m.slotsCleared >= 5, points: m.points })),
    );
    const payout = settled.payouts.find((p) => p.userId === "maya")!;
    const cents = payout.refundCents + payout.winningsCents;

    const projection = projectPayout({ stakeUsd: 20, members: league, userId: "maya", daysLeft: 0 });
    expect(cents).toBe(2000 + 2700);
    expect(projection).toMatchObject({
      eligible: true,
      ifEndedNowCents: cents,
      expectedCents: cents,
      lowCents: cents,
      highCents: cents,
      finishProbability: 1,
    });
  });

  test("a non-finisher with no time left gets nothing", () => {
    const projection = projectPayout({ stakeUsd: 20, members: league, userId: "ana", daysLeft: 0 });
    expect(projection).toMatchObject({
      ifEndedNowCents: 0,
      expectedCents: 0,
      lowCents: 0,
      highCents: 0,
      finishProbability: 0,
    });
  });

  test("everyone finished returns exactly the stake", () => {
    const projection = projectPayout({
      stakeUsd: 15,
      members: [finisher("maya", 300), finisher("sam", 100), finisher("ana", 50)],
      userId: "sam",
      daysLeft: 2,
    });
    expect(projection).toMatchObject({
      ifEndedNowCents: 1500,
      expectedCents: 1500,
      lowCents: 1500,
      highCents: 1500,
    });
  });

  test("a sole finisher takes the stake plus 90% of the others' stakes", () => {
    const projection = projectPayout({
      stakeUsd: 10,
      members: [finisher("maya", 300), member("sam"), member("ana"), member("leo")],
      userId: "maya",
      daysLeft: 0,
    });
    expect(projection.ifEndedNowCents).toBe(1000 + 2700);
    expect(projection.expectedCents).toBe(3700);
  });

  test("nobody finished at day 0 refunds every stake", () => {
    const projection = projectPayout({
      stakeUsd: 10,
      members: [member("maya", { slotsCleared: 4 }), member("sam", { slotsCleared: 2 })],
      userId: "maya",
      daysLeft: 0,
    });
    expect(projection).toMatchObject({
      ifEndedNowCents: 1000,
      expectedCents: 1000,
      lowCents: 1000,
      highCents: 1000,
    });
  });
});

describe("finishProbability", () => {
  test("is 1 once every slot is cleared, whatever the clock says", () => {
    expect(finishProbability(5, 0)).toBe(1);
    expect(finishProbability(5, 3)).toBe(1);
  });

  test("is 0 with no time left and slots open", () => {
    expect(finishProbability(4, 0)).toBe(0);
  });

  test("rises with slots cleared", () => {
    const chances = [0, 1, 2, 3, 4].map((cleared) => finishProbability(cleared, 3));
    for (let i = 1; i < chances.length; i++) expect(chances[i]).toBeGreaterThan(chances[i - 1]);
  });

  test("rises with days left for the same slots cleared", () => {
    // Holding slotsCleared fixed, more time means more chances to clear the rest.
    const chances = [0.5, 1, 2, 3, 5].map((days) => finishProbability(3, days));
    for (let i = 1; i < chances.length; i++) expect(chances[i]).toBeGreaterThan(chances[i - 1]);
  });

  test("matches the pace model computed by hand", () => {
    // 4 of 5 cleared, 3.5 of 7 days gone: rate = (4 + 5/7 x 2) / (3.5 + 2), mean = rate x 3.5,
    // and the chance of at least one more slot is 1 - e^-mean.
    const mean = ((4 + (5 / 7) * 2) / 5.5) * 3.5;
    expect(finishProbability(4, 3.5)).toBeCloseTo(1 - Math.exp(-mean), 12);
  });

  test("clamps days left into the period", () => {
    expect(finishProbability(2, -3)).toBe(0);
    expect(finishProbability(2, 99)).toBe(finishProbability(2, 7));
  });

  test("scales to a season", () => {
    expect(finishProbability(40, 10, 40, 56)).toBe(1);
    expect(finishProbability(30, 0, 40, 56)).toBe(0);
    expect(finishProbability(35, 14, 40, 56)).toBeGreaterThan(finishProbability(25, 14, 40, 56));
  });
});

describe("projectPayout with a live clock", () => {
  test("a two-player week matches the expected value worked out by hand", () => {
    const members = [finisher("maya", 200), member("sam", { points: 150, slotsCleared: 4 })];
    const mean = ((4 + (5 / 7) * 2) / 5.5) * 3.5;
    const samFinishes = 1 - Math.exp(-mean);

    const maya = projectPayout({ stakeUsd: 10, members, userId: "maya", daysLeft: 3.5 });
    // Sam misses: Maya takes $10 back and 90% of Sam's $10. Sam finishes: both only get stakes back.
    expect(maya.expectedCents).toBe(Math.round(1000 + 900 * (1 - samFinishes)));
    expect(maya.ifEndedNowCents).toBe(1900);
    expect(maya.lowCents).toBe(1000);
    expect(maya.highCents).toBe(1900);

    const sam = projectPayout({ stakeUsd: 10, members, userId: "sam", daysLeft: 3.5 });
    expect(sam.finishProbability).toBeCloseTo(samFinishes, 12);
    expect(sam.expectedCents).toBe(Math.round(1000 * samFinishes));
    expect(sam.ifEndedNowCents).toBe(0);
    expect(sam.lowCents).toBe(0);
    expect(sam.highCents).toBe(1000);
  });

  test("a late finisher's points include the bonuses for the slots they close out", () => {
    // Sam (4 slots, 150 points) would finish on 150 + 55 + 100 = 305. Leo (no slots, no points)
    // would finish on 5 x 55 + 100 = 375. Maya has finished already, on 200.
    const members = [
      finisher("maya", 200),
      member("sam", { points: 150, slotsCleared: 4 }),
      member("leo"),
    ];
    const daysLeft = 3.5;
    const sam = finishProbability(4, daysLeft);
    const leo = finishProbability(0, daysLeft);

    const bothMiss = (1 - sam) * (1 - leo) * (1000 + 1800);
    const onlySamFinishes = sam * (1 - leo) * (1000 + (900 * 200) / 505);
    const onlyLeoFinishes = (1 - sam) * leo * (1000 + (900 * 200) / 575);
    const bothFinish = sam * leo * 1000;
    const expected = bothMiss + onlySamFinishes + onlyLeoFinishes + bothFinish;

    const maya = projectPayout({ stakeUsd: 10, members, userId: "maya", daysLeft });
    // Each scenario rounds its own cents, so the hand figure is within a cent of the function.
    expect(Math.abs(maya.expectedCents - expected)).toBeLessThanOrEqual(1);
    expect(maya.highCents).toBe(1000 + 1800);
    expect(maya.lowCents).toBe(1000);
  });

  test("low <= expected <= high across a grid of leagues", () => {
    const checked: Projection[] = [];
    for (const daysLeft of [0, 0.5, 2, 3.5, 6, 7]) {
      for (const cleared of [0, 1, 3, 4, 5]) {
        for (const rivalCleared of [0, 2, 4, 5]) {
          for (const stakeUsd of [1, 7.5, 25]) {
            const members = [
              member("me", { points: 120, slotsCleared: cleared }),
              member("a", { points: 200, slotsCleared: rivalCleared }),
              member("b", { points: 60, slotsCleared: 2 }),
              member("c", { paid: false, points: 500, slotsCleared: 5 }),
            ];
            for (const userId of ["me", "a", "b"]) {
              const projection = projectPayout({ stakeUsd, members, userId, daysLeft });
              expect(projection.lowCents).toBeLessThanOrEqual(projection.expectedCents);
              expect(projection.expectedCents).toBeLessThanOrEqual(projection.highCents);
              expect(projection.finishProbability).toBeGreaterThanOrEqual(0);
              expect(projection.finishProbability).toBeLessThanOrEqual(1);
              expect(Number.isInteger(projection.expectedCents)).toBe(true);
              checked.push(projection);
            }
          }
        }
      }
    }
    expect(checked.length).toBeGreaterThan(1000);
  });

  test("a 20-member league of undecided players is fast, deterministic and in bounds", () => {
    const members = Array.from({ length: 20 }, (_, i) =>
      member(`p${i}`, { points: 50 + i * 7, slotsCleared: 2 + (i % 3) }),
    );
    const started = performance.now();
    const projection = projectPayout({ stakeUsd: 10, members, userId: "p3", daysLeft: 3 });
    const elapsedMs = performance.now() - started;

    expect(elapsedMs).toBeLessThan(100);
    expect(projection).toEqual(projectPayout({ stakeUsd: 10, members, userId: "p3", daysLeft: 3 }));
    expect(projection.lowCents).toBeLessThanOrEqual(projection.expectedCents);
    expect(projection.expectedCents).toBeLessThanOrEqual(projection.highCents);
    // Nobody can take more than their stake plus every other stake.
    expect(projection.highCents).toBeLessThanOrEqual(20 * 1000);
  });

  test("a season league uses 5 x weeks slots over 7 x weeks days", () => {
    const members = [
      member("maya", { points: 900, slotsCleared: 30 }),
      member("sam", { points: 800, slotsCleared: 28 }),
      member("ana", { points: 300, slotsCleared: 12 }),
    ];
    const projection = projectPayout({
      stakeUsd: 50,
      members,
      userId: "maya",
      daysLeft: 14,
      slotsNeeded: 40,
      periodDays: 56,
    });
    expect(projection.finishProbability).toBe(finishProbability(30, 14, 40, 56));
    expect(projection.finishProbability).toBeGreaterThan(0);
    expect(projection.finishProbability).toBeLessThan(1);
    expect(projection.lowCents).toBeLessThanOrEqual(projection.expectedCents);
    expect(projection.expectedCents).toBeLessThanOrEqual(projection.highCents);
    expect(projection.highCents).toBe(5000 + Math.round(5000 * 2 * 0.9));
  });
});

describe("projectionLabel", () => {
  const base: Projection = {
    eligible: true,
    stakeCents: 1000,
    ifEndedNowCents: 0,
    expectedCents: 1000,
    lowCents: 0,
    highCents: 2000,
    finishProbability: 0.5,
  };

  test("shows a gain", () => {
    expect(projectionLabel({ ...base, expectedCents: 2240 })).toBe("Projected: +$12.40");
  });

  test("shows zero as a plus", () => {
    expect(projectionLabel(base)).toBe("Projected: +$0.00");
  });

  test("shows a loss", () => {
    expect(projectionLabel({ ...base, stakeCents: 1000, expectedCents: 500 })).toBe("Projected: -$5.00");
  });

  test("tells an unpaid member what puts them in the pot", () => {
    expect(projectionLabel({ ...base, eligible: false, expectedCents: 0 })).toBe("Pay $10 to play for the pot");
    expect(projectionLabel({ ...base, eligible: false, stakeCents: 250, expectedCents: 0 })).toBe("Pay $2.50 to play for the pot");
  });

  test("shows nothing to win where there is no stake", () => {
    expect(projectionLabel({ ...base, eligible: false, stakeCents: 0, expectedCents: 0 })).toBe("Projected: +$0.00");
  });
});
