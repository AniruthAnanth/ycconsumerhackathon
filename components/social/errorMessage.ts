import { ConvexError } from "convex/values";

/** The line to show when a backend call fails: the server's own wording when it sent some. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  return error instanceof ConvexError && typeof error.data === "string" ? error.data : fallback;
}
