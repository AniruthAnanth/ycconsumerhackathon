/**
 * Earnings projection for one league week (SPEC.md section 2), as pure functions.
 *
 * Settlement only runs when the week ends, but a player wants to see what they stand
 * to take home today. The projection answers with the payout if the week ended now,
 * a probability-weighted expectation, and the range around it. Every payout figure
 * comes from computeSettlement, so the projection can never disagree with the
 * settlement it forecasts.
 */

import { computeSettlement, type Entrant } from "./settlement";

const DEFAULT_SLOTS_NEEDED = 5;
const DEFAULT_PERIOD_DAYS = 7;

/**
 * How many days of evidence the "all the slots, spread evenly" prior is worth. A
 * player's own pace is noisy after a day or two: the prior stops a strong Monday or an
 * empty Monday from deciding the whole week, and fades as real days pile up.
 */
const PRIOR_WEIGHT_DAYS = 2;

/**
 * Points a member gains in a scenario for each slot they still have open, matching what
 * the scoring module awards: the slot bonus plus a typical task. Only the ratio of
 * finishers' points matters to the split, so these keep a late finisher's share honest
 * without modelling anyone's pace.
 */
const SLOT_BONUS_POINTS = 25;
const TYPICAL_TASK_POINTS = 30;

/** The bonus for clearing all five slots. A season scales it with the number of slots. */
const SWEEP_BONUS_POINTS = 100;
const SLOTS_PER_WEEK = 5;

/**
 * Scenarios double with every undecided member. 12 members is 4,096 settlements, which
 * is instant; a bigger league fixes its most certain members instead of sampling, so
 * the result stays deterministic.
 */
const MAX_ENUMERATED_MEMBERS = 12;

export type ProjectionMember<UserId> = {
  userId: UserId;
  paid: boolean;
  /** Points so far this week (or this season). */
  points: number;
  /** Roster slots cleared so far, 0..slotsNeeded. */
  slotsCleared: number;
};

export type Projection = {
  /** False for an unpaid member or a free league: nothing to win, every amount is 0. */
  eligible: boolean;
  stakeCents: number;
  /** Payout (stake back plus winnings) if the week were settled on the standings as they are. */
  ifEndedNowCents: number;
  /** Probability-weighted payout at the end of the week. */
  expectedCents: number;
  /** The player clears no further slot and every rival who still can finish, does. */
  lowCents: number;
  /** The player clears all five and no rival clears another slot. */
  highCents: number;
  /** 0..1 chance this player clears every slot before the week ends. */
  finishProbability: number;
};

/**
 * Chance of clearing every remaining slot in the time left.
 *
 * The clearing rate (slots per day) blends the player's own pace so far with the prior
 * pace needed to finish exactly on time. Slots cleared in the time left are then
 * Poisson-distributed, so the chance is the tail P(cleared >= slots still open).
 */
export function finishProbability(
  slotsCleared: number,
  daysLeft: number,
  slotsNeeded = DEFAULT_SLOTS_NEEDED,
  periodDays = DEFAULT_PERIOD_DAYS,
): number {
  const slotsOpen = slotsNeeded - slotsCleared;
  if (slotsOpen <= 0) return 1;
  const remainingDays = Math.min(Math.max(daysLeft, 0), periodDays);
  if (remainingDays === 0) return 0;

  const daysElapsed = periodDays - remainingDays;
  const priorRate = slotsNeeded / periodDays;
  const rate =
    (slotsCleared + priorRate * PRIOR_WEIGHT_DAYS) / (daysElapsed + PRIOR_WEIGHT_DAYS);
  const mean = rate * remainingDays;

  let term = Math.exp(-mean);
  let probabilityBelowOpen = 0;
  for (let cleared = 0; cleared < slotsOpen; cleared++) {
    probabilityBelowOpen += term;
    term = (term * mean) / (cleared + 1);
  }
  return Math.min(1, Math.max(0, 1 - probabilityBelowOpen));
}

export function projectPayout<UserId>(input: {
  stakeUsd: number;
  /** The whole league, the player included. */
  members: ProjectionMember<UserId>[];
  /** Whose payout to project. */
  userId: UserId;
  /** Days until settlement, fractions allowed. Clamped to 0..periodDays. */
  daysLeft: number;
  /** A season-payout league passes 5 x weeks. */
  slotsNeeded?: number;
  /** A season-payout league passes 7 x weeks. */
  periodDays?: number;
}): Projection {
  const { stakeUsd, members, userId } = input;
  const slotsNeeded = input.slotsNeeded ?? DEFAULT_SLOTS_NEEDED;
  const periodDays = input.periodDays ?? DEFAULT_PERIOD_DAYS;
  const daysLeft = Math.min(Math.max(input.daysLeft, 0), periodDays);
  const stakeCents = Math.round(stakeUsd * 100);

  const player = members.find((member) => member.userId === userId);
  if (!player || !player.paid || stakeCents === 0) {
    return {
      eligible: false,
      stakeCents,
      ifEndedNowCents: 0,
      expectedCents: 0,
      lowCents: 0,
      highCents: 0,
      finishProbability: 0,
    };
  }

  const sweepBonus = (SWEEP_BONUS_POINTS * slotsNeeded) / SLOTS_PER_WEEK;
  const pointsIfFinished = (member: ProjectionMember<UserId>) =>
    member.points +
    (slotsNeeded - member.slotsCleared) * (SLOT_BONUS_POINTS + TYPICAL_TASK_POINTS) +
    sweepBonus;

  const chances = members.map((member) =>
    finishProbability(member.slotsCleared, daysLeft, slotsNeeded, periodDays),
  );
  const finishedNow = members.map((member) => member.slotsCleared >= slotsNeeded);

  const payoutCents = (finishes: boolean[]): number => {
    const entrants: Entrant<UserId>[] = members.map((member, i) => ({
      userId: member.userId,
      paid: member.paid,
      finished: finishes[i],
      points: finishes[i] && !finishedNow[i] ? pointsIfFinished(member) : member.points,
    }));
    const payout = computeSettlement(stakeUsd, entrants).payouts.find(
      (candidate) => candidate.userId === userId,
    );
    return payout ? payout.refundCents + payout.winningsCents : 0;
  };

  const playerIndex = members.indexOf(player);
  const ifEndedNowCents = payoutCents(finishedNow);

  // Paid members whose outcome is still open. Everyone else is fixed at what they are.
  const undecided = members
    .map((_, i) => i)
    .filter((i) => members[i].paid && !finishedNow[i] && chances[i] > 0);
  const enumerated = [...undecided]
    .sort((a, b) => Math.abs(chances[b] - 0.5) - Math.abs(chances[a] - 0.5) || a - b)
    .slice(Math.max(0, undecided.length - MAX_ENUMERATED_MEMBERS))
    .sort((a, b) => a - b);

  // Undecided members outside the enumeration sit at their likelier outcome.
  const scenario = members.map(
    (_, i) => finishedNow[i] || (undecided.includes(i) && chances[i] >= 0.5),
  );
  let expected = 0;
  for (let mask = 0; mask < 1 << enumerated.length; mask++) {
    let probability = 1;
    enumerated.forEach((i, bit) => {
      const finishes = (mask >> bit) & 1;
      scenario[i] = finishes === 1;
      probability *= finishes ? chances[i] : 1 - chances[i];
    });
    expected += probability * payoutCents(scenario);
  }
  const expectedCents = Math.round(expected);

  const canFinish = (i: number) => finishedNow[i] || (members[i].paid && chances[i] > 0);
  const lowCents = payoutCents(
    members.map((_, i) => finishedNow[i] || (i !== playerIndex && canFinish(i))),
  );
  const highCents = payoutCents(
    members.map((_, i) => finishedNow[i] || (i === playerIndex && canFinish(i))),
  );

  return {
    eligible: true,
    stakeCents,
    ifEndedNowCents,
    expectedCents,
    // The nobody-finishes refund can put the expectation outside the two named scenarios.
    lowCents: Math.min(lowCents, expectedCents),
    highCents: Math.max(highCents, expectedCents),
    finishProbability: chances[playerIndex],
  };
}

/** "Projected: +$12.40": the expected payout minus the stake the player put in. */
export function projectionLabel(projection: Projection): string {
  const netCents = projection.eligible ? projection.expectedCents - projection.stakeCents : 0;
  const dollars = (Math.abs(netCents) / 100).toFixed(2);
  return `Projected: ${netCents < 0 ? "-" : "+"}$${dollars}`;
}
