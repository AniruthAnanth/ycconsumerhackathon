/**
 * When a downward drag on a sheet or the camera counts as "put it away": far enough, or flicked
 * fast enough. One rule for every swipe-to-dismiss, so each surface lets go at the same point.
 * Runs on the UI thread inside a gesture, hence the worklet directive.
 */
export const DISMISS_DISTANCE = 120;
export const DISMISS_VELOCITY = 900;

export function shouldDismiss(translationY: number, velocityY: number): boolean {
  "worklet";
  if (translationY <= 0) return false;
  return translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY;
}
