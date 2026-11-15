import { describe, expect, it } from "vitest";

import {
  cardShareText,
  indexAfterTap,
  KIND_BACKGROUND,
  KIND_LABEL,
  nextIndex,
  pageIndexFromOffset,
  previousIndex,
  tapClosesStory,
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

  it("advances on the middle third too", () => {
    expect(indexAfterTap(180, 360, 1, 5)).toBe(2);
    expect(indexAfterTap(120, 360, 1, 5)).toBe(2);
    expect(indexAfterTap(119, 360, 1, 5)).toBe(0);
  });

  it("stays on the first card for a left-third tap", () => {
    expect(indexAfterTap(40, 360, 0, 5)).toBe(0);
  });

  it("does not run past the last card", () => {
    expect(indexAfterTap(340, 360, 4, 5)).toBe(4);
  });
});

describe("tapClosesStory", () => {
  it("closes on a forward tap on the last card, middle or right", () => {
    expect(tapClosesStory(340, 360, 4, 5)).toBe(true);
    expect(tapClosesStory(180, 360, 4, 5)).toBe(true);
  });

  it("does not close on an earlier card", () => {
    expect(tapClosesStory(340, 360, 3, 5)).toBe(false);
    expect(tapClosesStory(180, 360, 3, 5)).toBe(false);
  });

  it("still goes back from the last card on a left-third tap", () => {
    expect(tapClosesStory(40, 360, 4, 5)).toBe(false);
    expect(indexAfterTap(40, 360, 4, 5)).toBe(3);
  });
});

describe("cardShareText", () => {
  it("says what the card says", () => {
    expect(
      cardShareText({ kind: "champion", stat: "142.5", title: "Maya won the week", subtitle: "By 12 points" }),
    ).toBe("LEAGUE CHAMPION: 142.5. Maya won the week. By 12 points (Lineup Wrapped)");
  });
});
