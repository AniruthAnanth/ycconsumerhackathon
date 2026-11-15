/** The referee watches at most this much video, so the camera stops there. */
export const MAX_VIDEO_SECONDS = 10;

export function secondsLeft(elapsedMs: number, maxSeconds: number = MAX_VIDEO_SECONDS): number {
  return Math.max(0, Math.ceil(maxSeconds - elapsedMs / 1000));
}

/** Recording length in whole milliseconds, never beyond the cap the camera enforces. */
export function recordedDurationMs(startedAt: number, stoppedAt: number, maxSeconds: number = MAX_VIDEO_SECONDS): number {
  return Math.min(Math.max(0, stoppedAt - startedAt), maxSeconds * 1000);
}
