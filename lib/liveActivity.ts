import { LiveActivityNative } from "../modules/live-activity";
import type { LiveActivityState } from "./liveActivityState";

export type { LiveActivityState } from "./liveActivityState";

/**
 * The Live Activity: the lock-screen card and Dynamic Island that show the open quick-time
 * drop's countdown, or else this week's matchup score.
 *
 * It is decoration. The native module exists only in a standalone iOS build; in Expo Go, on
 * Android and on the web every call here resolves at once and does nothing, and none of
 * them ever throws, so callers need no platform checks and a failure never reaches a screen.
 *
 * REMOTE UPDATES (not built): the activity is started and updated by this app while it is
 * open. Moving the score while the app is closed needs ActivityKit push: request the activity
 * with pushType .token in modules/live-activity/ios/LiveActivityModule.swift, send the token
 * to Convex, and have a Convex action post the new content-state to APNs with an APNs auth
 * key (.p8). We have no APNs credentials today, so that path stops here.
 */

/** True when this build contains the module and the player allows Live Activities for Lineup. */
export function isAvailable(): boolean {
  try {
    return LiveActivityNative?.areActivitiesEnabled() ?? false;
  } catch {
    return false;
  }
}

/** Shows a quick-time drop, updating the running activity or requesting a new one. */
export function startDrop(state: LiveActivityState): Promise<void> {
  return show(state);
}

/** Shows the week's matchup, updating the running activity or requesting a new one. */
export function startMatchup(state: LiveActivityState): Promise<void> {
  return show(state);
}

/** Updates the running activity; does nothing when there is none. */
export async function update(state: LiveActivityState): Promise<void> {
  try {
    await LiveActivityNative?.update(JSON.stringify(state));
  } catch {}
}

/** Removes the activity from the lock screen and the island at once. */
export async function end(): Promise<void> {
  try {
    await LiveActivityNative?.end();
  } catch {}
}

async function show(state: LiveActivityState): Promise<void> {
  try {
    await LiveActivityNative?.start(JSON.stringify(state));
  } catch {}
}
