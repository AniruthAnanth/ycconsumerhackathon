import { ConvexError } from "convex/values";

/** A failure on the phone itself (no GPS fix, a permission that is off), with a message written for the player. */
export class DeviceError extends Error {}

/**
 * The text to show a player when something they asked for fails. Only a ConvexError (in `data`)
 * and a DeviceError carry a message written for people; anything else is a transport or server
 * error whose text is noise on a phone, so it becomes the fallback.
 */
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (error instanceof DeviceError) return error.message;
  if (!(error instanceof ConvexError)) return fallback;
  const data: unknown = error.data;
  if (typeof data === "string" && data !== "") return data;
  if (typeof data === "object" && data !== null && "message" in data && typeof data.message === "string") {
    return data.message;
  }
  return fallback;
}
