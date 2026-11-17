import { describe, expect, it } from "vitest";

import { blinkPlan, flickPlan, wander } from "./sunnyMotion";
import { SUNNY_PARTS } from "./sunnyParts";

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe("sunny motion plans", () => {
  it("keeps wander steps inside the reach and the time range", () => {
    for (const step of wander(seeded(3), 50, 2, 800, 2200)) {
      expect(Math.abs(step.to)).toBeLessThanOrEqual(2);
      expect(step.ms).toBeGreaterThanOrEqual(800);
      expect(step.ms).toBeLessThan(2200);
    }
  });

  it("never repeats the same blink gap twice in a row", () => {
    const waits = blinkPlan(seeded(7), 10).map((blink) => blink.wait);
    expect(new Set(waits).size).toBe(waits.length);
    expect(Math.min(...waits)).toBeGreaterThanOrEqual(1800);
  });

  it("flicks ears to both sides", () => {
    const signs = new Set(flickPlan(seeded(11), 30).map((flick) => Math.sign(flick.amount)));
    expect(signs).toEqual(new Set([-1, 1]));
  });
});

describe("SUNNY_PARTS", () => {
  it("splits the drawing into two ears and a body", () => {
    expect(SUNNY_PARTS.leftEar.match(/<path/g)).toHaveLength(1);
    expect(SUNNY_PARTS.rightEar.match(/<path/g)).toHaveLength(1);
    expect(SUNNY_PARTS.body.match(/<path/g)?.length).toBeGreaterThan(5);
  });
});
