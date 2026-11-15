import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import { chatKey, createChatStore, retryMessage, sendMessage } from "./chatStore";

const key = chatKey("league1", "userA");

describe("chatStore", () => {
  it("keeps a thread per league and player", async () => {
    const store = createChatStore();
    await sendMessage(store, key, async () => ({ reply: "hi" }), "Standings");
    expect(store.get(key).messages.map((m) => m.text)).toEqual(["Standings", "hi"]);
    expect(store.get(chatKey("league1", "userB")).messages).toEqual([]);
    expect(store.get(chatKey("league2", "userA")).messages).toEqual([]);
  });

  it("lands a reply that arrives after the listener left", async () => {
    const store = createChatStore();
    let seen = 0;
    const unsubscribe = store.subscribe(() => seen++);
    let answer: (value: { reply: string }) => void = () => undefined;
    const sending = sendMessage(store, key, () => new Promise((resolve) => (answer = resolve)), "Who am I playing?");
    expect(store.get(key).pending).toBe(true);
    unsubscribe();
    answer({ reply: "Maya Chen" });
    await sending;
    expect(seen).toBe(1);
    expect(store.get(key)).toMatchObject({ pending: false, messages: [{ role: "user" }, { role: "agent", text: "Maya Chen" }] });
  });

  it("keeps the server's wording on a failed send, then retry replaces it with the reply", async () => {
    const store = createChatStore();
    await sendMessage(store, key, async () => Promise.reject(new ConvexError("You are not in this league")), "hi");
    expect(store.get(key).messages[0].error).toBe("You are not in this league");
    await retryMessage(store, key, async () => ({ reply: "ok" }), "0");
    expect(store.get(key).messages).toEqual([
      { id: "0", role: "user", text: "hi", error: undefined },
      { id: "1", role: "agent", text: "ok" },
    ]);
  });

  it("falls back to a plain line for a failure with no message of its own", async () => {
    const store = createChatStore();
    await sendMessage(store, key, async () => Promise.reject(new Error("boom")), "hi");
    expect(store.get(key).messages[0].error).toBe("The league agent didn't answer.");
  });

  it("ignores a retry while a reply is pending", async () => {
    const store = createChatStore();
    await sendMessage(store, key, async () => Promise.reject(new Error("x")), "a");
    void sendMessage(store, key, () => new Promise(() => undefined), "b");
    let asked = false;
    await retryMessage(store, key, async () => ((asked = true), { reply: "" }), "0");
    expect(asked).toBe(false);
  });
});
