/**
 * Pure helpers for Sunny's idle motion. Each moving layer gets its own long run of randomly timed
 * steps, built once per mount, so the layers drift in and out of step and the whole never reads as
 * one short loop.
 */

export type Rng = () => number;

/** A value in [min, max). */
export function between(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

export type Step = { to: number; ms: number };

/** n steps that each go to a random target in [-reach, reach] and take a random time. */
export function wander(rng: Rng, n: number, reach: number, minMs: number, maxMs: number): Step[] {
  return Array.from({ length: n }, () => ({ to: between(rng, -reach, reach), ms: between(rng, minMs, maxMs) }));
}

/** Blink schedule: a random pause before each blink, and now and then a quick second blink. */
export function blinkPlan(rng: Rng, n: number): { wait: number; close: number; open: number; double: boolean }[] {
  return Array.from({ length: n }, () => ({
    wait: between(rng, 1800, 5200),
    close: between(rng, 60, 95),
    open: between(rng, 100, 160),
    double: rng() < 0.2,
  }));
}

/** Ear flick schedule: long rests, and a flick that varies in size and side each time. */
export function flickPlan(rng: Rng, n: number): { wait: number; amount: number; ms: number }[] {
  return Array.from({ length: n }, () => ({
    wait: between(rng, 2500, 9000),
    amount: between(rng, 4, 11) * (rng() < 0.5 ? -1 : 1),
    ms: between(rng, 70, 130),
  }));
}
