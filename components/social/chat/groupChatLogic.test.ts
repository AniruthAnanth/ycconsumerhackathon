import { describe, expect, it } from "vitest";

import type { ChatPost } from "@/components/social/contract";

import { buildRows, dayLabel, formatTime, snippet } from "./groupChatLogic";

const at = (h: number, m: number, day = 15) => new Date(2026, 10, day, h, m).getTime();
const post = (id: string, who: string, createdAt: number): ChatPost => ({
  _id: id as ChatPost["_id"],
  author: who === "sunny" ? { kind: "sunny" } : { kind: "member", userId: who as never, name: who },
  mine: false,
  text: id,
  createdAt,
  reactions: [],
});

describe("buildRows", () => {
  it("groups one author's posts within five minutes and starts a new group after", () => {
    const rows = buildRows([post("a", "u1", at(9, 0)), post("b", "u1", at(9, 4)), post("c", "u1", at(9, 20)), post("d", "sunny", at(9, 21))], at(12, 0));
    const posts = rows.filter((r) => r.kind === "post");
    expect(rows[0]).toEqual({ kind: "day", key: `day-${at(9, 0)}`, label: "Today" });
    expect(posts.map((r) => [r.first, r.last])).toEqual([
      [true, false],
      [false, true],
      [true, true],
      [true, true],
    ]);
  });

  it("adds a separator when the day changes", () => {
    const rows = buildRows([post("a", "u1", at(23, 58, 14)), post("b", "u1", at(0, 1))], at(12, 0));
    expect(rows.map((r) => r.kind)).toEqual(["day", "post", "day", "post"]);
    expect(rows.filter((r) => r.kind === "day").map((r) => (r.kind === "day" ? r.label : ""))).toEqual(["Yesterday", "Today"]);
  });
});

describe("formatTime", () => {
  it("uses a 12-hour clock", () => {
    expect(formatTime(at(16, 52))).toBe("4:52 PM");
    expect(formatTime(at(0, 5))).toBe("12:05 AM");
    expect(formatTime(at(12, 0))).toBe("12:00 PM");
  });
});

describe("dayLabel", () => {
  it("names older days by weekday and date", () => {
    expect(dayLabel(at(9, 0, 10), at(9, 0))).toBe("Tue, Nov 10");
  });
});

describe("snippet", () => {
  it("keeps the first line and cuts long text", () => {
    expect(snippet("hi\nthere")).toBe("hi");
    expect(snippet("x".repeat(100), 10)).toBe("xxxxxxxxx…");
  });
});
