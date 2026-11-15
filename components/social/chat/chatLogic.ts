import { ConvexError } from "convex/values";

export type ChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  /** Server message for a user message whose request failed. */
  error?: string;
};

export type ChatState = { messages: ChatMessage[]; pending: boolean };

export type ChatAction =
  | { type: "send"; id: string; text: string }
  | { type: "reply"; id: string; text: string }
  | { type: "fail"; id: string; error: string }
  | { type: "retry"; id: string };

export const initialChatState: ChatState = { messages: [], pending: false };

export const SUGGESTIONS = ["Standings", "What's left this week?", "Who am I playing?"];

const FALLBACK_ERROR = "The league agent didn't answer.";

/**
 * One request is in flight at a time, so `pending` is a single flag: a reply or
 * a failure clears it, and a failed message stays in place until it is retried.
 */
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "send":
      return {
        messages: [...state.messages, { id: action.id, role: "user", text: action.text }],
        pending: true,
      };
    case "reply":
      return {
        messages: [...state.messages, { id: action.id, role: "agent", text: action.text }],
        pending: false,
      };
    case "fail":
      return {
        messages: state.messages.map((m) => (m.id === action.id ? { ...m, error: action.error } : m)),
        pending: false,
      };
    case "retry":
      return {
        messages: state.messages.map((m) => (m.id === action.id ? { ...m, error: undefined } : m)),
        pending: true,
      };
  }
}

export function canSend(text: string, pending: boolean): boolean {
  return !pending && text.trim().length > 0;
}

/** The server's own message when it threw a ConvexError with a string, else a generic line. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return FALLBACK_ERROR;
}
