import { arrivedAt, type ProofTarget } from "@/convex/lib/notificationContent";

import { raise } from "./native";

/**
 * Announces that the phone has reached the place a task is done at, with Check In and Pass on
 * the notification.
 *
 * The check-in prompt calls this (components/checkin), because that is where arrival is
 * detected: it reads the position, in the foreground only, and a second reader here would be a
 * second opinion on where the player is. `placeName` is the phone's name for the spot, used
 * when the task has no pin of its own. Nothing is raised while notifications are off.
 */
export function announceArrival(task: ProofTarget, placeName?: string): void {
  void raise(arrivedAt(task, task.place?.name ?? placeName));
}
