import { ConvexError } from "convex/values";

/**
 * The text to show a player when a backend call fails. Only a ConvexError carries a message
 * written for people (in `data`); anything else is a transport or server error whose text is
 * noise on a phone, so it becomes the fallback.
 */
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (!(error instanceof ConvexError)) return fallback;
  const data: unknown = error.data;
  if (typeof data === "string" && data !== "") return data;
  if (typeof data === "object" && data !== null && "message" in data && typeof data.message === "string") {
    return data.message;
  }
  return fallback;
}
