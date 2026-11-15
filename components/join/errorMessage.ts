import { ConvexError } from "convex/values";

/** The server throws ConvexError with a readable string for expected failures (wrong code, full league). */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return "Something went wrong. Try again.";
}
