import { describe, expect, it } from "vitest";

import { canSend, chatReducer, initialChatState, type ChatState } from "./chatLogic";

const sent: ChatState = chatReducer(initialChatState, { type: "send", id: "1", text: "Standings" });

describe("chatReducer", () => {
  it("send appends my message and marks a reply pending", () => {
    expect(sent.pending).toBe(true);
    expect(sent.messages).toEqual([{ id: "1", role: "user", text: "Standings" }]);
  });

  it("reply appends the agent's message and clears pending", () => {
    const next = chatReducer(sent, { type: "reply", id: "2", text: "You lead 41.0 to 38.5." });
    expect(next.pending).toBe(false);
    expect(next.messages.map((m) => m.role)).toEqual(["user", "agent"]);
  });

  it("fail marks only that message and clears pending", () => {
    const next = chatReducer(sent, { type: "fail", id: "1", error: "Offline" });
    expect(next.pending).toBe(false);
    expect(next.messages[0].error).toBe("Offline");
  });

  it("retry clears the error and goes pending again without duplicating the message", () => {
    const failed = chatReducer(sent, { type: "fail", id: "1", error: "Offline" });
    const next = chatReducer(failed, { type: "retry", id: "1" });
    expect(next.pending).toBe(true);
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0].error).toBeUndefined();
  });
});

describe("canSend", () => {
  it("needs non-blank text and no reply in flight", () => {
    expect(canSend("hi", false)).toBe(true);
    expect(canSend("   ", false)).toBe(false);
    expect(canSend("hi", true)).toBe(false);
  });
});
