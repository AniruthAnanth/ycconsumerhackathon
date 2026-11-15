import type { Id } from "@/convex/_generated/dataModel";

// 4 decimals is about 11 m: coarse enough that GPS jitter does not change the
// Convex query's arguments (and so refetch it) on every read.
export const roundCoordinate = (degrees: number) => Math.round(degrees * 1e4) / 1e4;

/**
 * Identifies one arrival. recordArrival is called once per key, so a re-render
 * or the minute tick never repeats it, while a new position fix does.
 */
export const arrivalKey = (taskId: Id<"tasks">, lat: number, lng: number) => `${taskId}:${lat}:${lng}`;
