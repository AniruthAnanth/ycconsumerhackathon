import { errorMessage } from "../errorMessage";
import { chatReducer, initialChatState, type ChatAction, type ChatState } from "./chatLogic";

export type ChatStore = {
  get(key: string): ChatState;
  subscribe(listener: () => void): () => void;
  dispatch(key: string, action: ChatAction): void;
};

/** One thread per league and player, so Switch Player never shows someone else's messages. */
export const chatKey = (leagueId: string, userId: string) => `${leagueId}:${userId}`;

export function createChatStore(): ChatStore {
  const threads = new Map<string, ChatState>();
  const listeners = new Set<() => void>();
  return {
    get: (key) => threads.get(key) ?? initialChatState,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(key, action) {
      threads.set(key, chatReducer(threads.get(key) ?? initialChatState, action));
      listeners.forEach((listener) => listener());
    },
  };
}

/** Lives as long as the app, so a reply that lands after the player left the screen is still kept. */
export const chatStore = createChatStore();

type Ask = (text: string) => Promise<{ reply: string }>;

// The outcome goes to the store, never to a component, so it survives the screen unmounting.
async function request(store: ChatStore, key: string, ask: Ask, messageId: string, text: string) {
  try {
    const { reply } = await ask(text);
    store.dispatch(key, { type: "reply", id: String(store.get(key).messages.length), text: reply });
  } catch (error) {
    store.dispatch(key, {
      type: "fail",
      id: messageId,
      error: errorMessage(error, "The league agent didn't answer."),
    });
  }
}

export function sendMessage(store: ChatStore, key: string, ask: Ask, text: string): Promise<void> {
  const id = String(store.get(key).messages.length);
  store.dispatch(key, { type: "send", id, text });
  return request(store, key, ask, id, text);
}

export async function retryMessage(store: ChatStore, key: string, ask: Ask, id: string): Promise<void> {
  const { messages, pending } = store.get(key);
  const message = messages.find((m) => m.id === id);
  if (!message || pending) return;
  store.dispatch(key, { type: "retry", id });
  await request(store, key, ask, id, message.text);
}
