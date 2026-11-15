import { describe, expect, it } from "vitest";

import {
  indexAfterTap,
  KIND_BACKGROUND,
  KIND_LABEL,
  nextIndex,
  pageIndexFromOffset,
  previousIndex,
} from "./wrappedLogic";

const KINDS = ["champion", "best_proof", "comeback", "fastest", "your_week"] as const;

describe("kind styling", () => {
  it("has a label and a background for every kind", () => {
    for (const kind of KINDS) {
      expect(KIND_LABEL[kind]).toMatch(/^[A-Z -]+$/);
      expect(KIND_BACKGROUND[kind]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("labels the cards as the brief words them", () => {
    expect(KIND_LABEL.fastest).toBe("FASTEST QUICK-TIME");
    expect(KIND_LABEL.comeback).toBe("BIGGEST COMEBACK");
  });

  it("gives each kind its own background", () => {
    expect(new Set(KINDS.map((kind) => KIND_BACKGROUND[kind])).size).toBe(KINDS.length);
  });
});

describe("pageIndexFromOffset", () => {
  it("rounds to the nearest page", () => {
    expect(pageIndexFromOffset(0, 400, 5)).toBe(0);
    expect(pageIndexFromOffset(390, 400, 5)).toBe(1);
    expect(pageIndexFromOffset(1200, 400, 5)).toBe(3);
  });

  it("clamps overscroll at both ends", () => {
    expect(pageIndexFromOffset(-80, 400, 5)).toBe(0);
    expect(pageIndexFromOffset(9000, 400, 5)).toBe(4);
  });

  it("returns 0 before the width or the cards are known", () => {
    expect(pageIndexFromOffset(200, 0, 5)).toBe(0);
    expect(pageIndexFromOffset(200, 400, 0)).toBe(0);
  });
});

describe("nextIndex and previousIndex", () => {
  it("move one card and stop at the ends", () => {
    expect(nextIndex(1, 5)).toBe(2);
    expect(nextIndex(4, 5)).toBe(4);
    expect(previousIndex(3)).toBe(2);
    expect(previousIndex(0)).toBe(0);
  });
});

describe("indexAfterTap", () => {
  it("advances on the right third", () => {
    expect(indexAfterTap(300, 360, 1, 5)).toBe(2);
  });

  it("goes back on the left third", () => {
    expect(indexAfterTap(40, 360, 1, 5)).toBe(0);
  });

  it("ignores the middle third", () => {
    expect(indexAfterTap(180, 360, 1, 5)).toBe(1);
  });

  it("does not run past the last card", () => {
    expect(indexAfterTap(340, 360, 4, 5)).toBe(4);
  });
});
