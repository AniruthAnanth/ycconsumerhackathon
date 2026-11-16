import { describe, expect, test } from "vitest";

import { areaPath, deltaPoints, hasLineups, deltaLabel, formatChance, formatNet, sparkPath, stepPath } from "./chartGeometry";

const box = { width: 108, height: 58, padding: 4 };

describe("stepPath", () => {
  test("holds each price flat, then steps to the next", () => {
    const line = stepPath(
      [
        { at: 0, value: 0.5 },
        { at: 50, value: 1 },
        { at: 100, value: 0 },
      ],
      box,
    );
    expect(line.d).toBe("M4.0 29.0 H54.0 V4.0 H104.0 V54.0");
    expect(line.length).toBe(50 + 25 + 50 + 50);
    expect(line.end).toEqual({ x: 104, y: 54 });
  });

  test("draws a single price as a flat line across the box", () => {
    const line = stepPath([{ at: 0, value: 0.5 }], box);
    expect(line.d).toBe("M4.0 29.0 H104.0");
    expect(line.length).toBe(100);
  });

  test("closes the area down to the floor", () => {
    const line = stepPath([{ at: 0, value: 0.5 }, { at: 1, value: 0.5 }], box);
    expect(areaPath(line, box)).toBe(`${line.d} V58 H4.0 Z`);
    expect(areaPath({ d: "", end: { x: 0 } }, box)).toBe("");
  });
});

describe("sparkPath", () => {
  test("scales to the series' own range and centres a flat one", () => {
    expect(sparkPath([{ at: 0, value: 0 }, { at: 1, value: 10 }], box)).toBe("M4.0 54.0 L104.0 4.0");
    expect(sparkPath([{ at: 0, value: 3 }], box)).toBe("M4.0 29.0 L104.0 29.0");
    expect(sparkPath([], box)).toBe("");
  });
});

describe("labels", () => {
  test("format chances, deltas and nets the way the cards print them", () => {
    expect(formatChance(0.624)).toBe("62%");
    expect(formatChance(1.2)).toBe("100%");
    expect(formatChance(0)).toBe("<1%");
    expect(formatChance(0.001)).toBe("<1%");
    expect(formatChance(0.999)).toBe(">99%");
    expect(deltaLabel(14)).toBe("+14 today");
    expect(deltaLabel(-3)).toBe("−3 today");
    expect(deltaLabel(0)).toBe("Flat today");
    expect(formatNet(34.4)).toBe("+$34");
    expect(formatNet(-8)).toBe("−$8");
    expect(formatNet(0.2)).toBe("$0");
  });
});

describe("hasLineups", () => {
  test("is false only while nobody has a task or a point", () => {
    expect(hasLineups([{ high: 0 }, { high: 0 }])).toBe(false);
    expect(hasLineups([{ high: 0 }, { high: 40 }])).toBe(true);
    expect(hasLineups([])).toBe(false);
  });
});

describe("deltaPoints", () => {
  test("shows the move with an arrow and a % sign", () => {
    expect(deltaPoints(1)).toBe("▲ 1%");
    expect(deltaPoints(-26)).toBe("▼ 26%");
    expect(deltaPoints(0)).toBe("▲ 0%");
  });
});
