import { dropOpened } from "@/convex/lib/notificationContent";

import { raiseAfter } from "./native";

/** Long enough to lock the phone or go to the home screen after pressing the control. */
const PREVIEW_DELAY_S = 5;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * The demo control "Preview Drop Notification": the quick-time drop notification, with its
 * Check In and Pass buttons, five seconds from now.
 *
 * It exists because a closed app can only be reached by a push, and a push needs Apple
 * credentials the project doesn't have yet. This one is scheduled on the phone itself, the way
 * the evening reminder is, so the presenter can press it, lock the screen and show what a drop
 * looks like when it arrives. The words come from the same builder as a real drop's.
 *
 * Resolves false when the phone won't show it: notifications are denied, or this is the web.
 */
export function previewDropNotification(): Promise<boolean> {
  const now = Date.now();
  const preview = dropOpened(
    { dropId: "preview", title: "20 push-ups", points: 40, gesture: "a thumbs up", closesAt: now + TWO_HOURS_MS },
    now,
  );
  return raiseAfter(preview, PREVIEW_DELAY_S);
}
