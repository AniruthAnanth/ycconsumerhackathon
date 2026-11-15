import { describe, expect, it } from "vitest";

import { dueLabel, flexCount, isFlexFull, isOnRoster, normalizeBaseUrl } from "./canvasLogic";

describe("normalizeBaseUrl", () => {
  it("adds https when the scheme is missing", () => {
    expect(normalizeBaseUrl("school.instructure.com")).toBe("https://school.instructure.com");
  });

  it("trims whitespace and drops path, query and trailing slash", () => {
    expect(normalizeBaseUrl("  https://school.instructure.com/courses/12?x=1  ")).toBe(
      "https://school.instructure.com",
    );
    expect(normalizeBaseUrl("school.instructure.com/")).toBe("https://school.instructure.com");
  });

  it("keeps an explicit scheme", () => {
    expect(normalizeBaseUrl("http://canvas.local:3000/api")).toBe("http://canvas.local:3000");
  });

  it("passes demo through unchanged", () => {
    expect(normalizeBaseUrl("demo")).toBe("demo");
    expect(normalizeBaseUrl(" demo ")).toBe("demo");
  });

  it("returns an empty string when there is no host", () => {
    expect(normalizeBaseUrl("   ")).toBe("");
    expect(normalizeBaseUrl("https:///path")).toBe("");
  });
});

describe("dueLabel", () => {
  it("says there is no due date when absent", () => {
    expect(dueLabel(undefined)).toBe("No due date");
  });

  it("formats weekday and 12-hour time", () => {
    expect(dueLabel(new Date(2026, 10, 17, 23, 59).getTime())).toBe("Due Tue 11:59 PM");
    expect(dueLabel(new Date(2026, 10, 18, 9, 5).getTime())).toBe("Due Wed 9:05 AM");
  });

  it("reads midnight and noon as 12", () => {
    expect(dueLabel(new Date(2026, 10, 15, 0, 0).getTime())).toBe("Due Sun 12:00 AM");
    expect(dueLabel(new Date(2026, 10, 15, 12, 0).getTime())).toBe("Due Sun 12:00 PM");
  });
});

const row = (slot: string, title: string, proofType = "photo") => ({ slot, title, proofType }) as Parameters<typeof isFlexFull>[0][number];

describe("flex limit", () => {
  const two = [row("body", "Gym"), row("flex", "A"), row("flex", "B")];

  it("counts only flex rows", () => {
    expect(flexCount(two)).toBe(2);
  });

  it("is full at three flex tasks and not before", () => {
    expect(isFlexFull(two)).toBe(false);
    expect(isFlexFull([...two, row("flex", "C")])).toBe(true);
  });
});

describe("isOnRoster", () => {
  const rows = [row("flex", "Problem Set 6", "canvas"), row("flex", "Problem Set 7")];

  it("finds a canvas task by title", () => {
    expect(isOnRoster(rows, "Problem Set 6")).toBe(true);
  });

  it("ignores the title of a task that is not a Canvas task", () => {
    expect(isOnRoster(rows, "Problem Set 7")).toBe(false);
  });

  it("compares the title as the server stores it", () => {
    expect(isOnRoster(rows, "  Problem   Set 6 ")).toBe(true);
    expect(isOnRoster([row("flex", "x".repeat(60), "canvas")], "x".repeat(70))).toBe(true);
  });
});
