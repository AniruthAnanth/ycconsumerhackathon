import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import { dueLabel, errorMessage, normalizeBaseUrl } from "./canvasLogic";

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

describe("errorMessage", () => {
  it("uses a ConvexError string", () => {
    expect(errorMessage(new ConvexError("Canvas rejected that token"))).toBe("Canvas rejected that token");
  });

  it("falls back for anything else", () => {
    expect(errorMessage(new ConvexError({ code: 1 }))).toBe("Something went wrong. Try again.");
    expect(errorMessage(new Error("Server Error"))).toBe("Something went wrong. Try again.");
  });
});
