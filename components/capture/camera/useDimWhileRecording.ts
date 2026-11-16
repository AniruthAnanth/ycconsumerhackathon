import * as Brightness from "expo-brightness";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/** Low enough to save the battery over a long timelapse, high enough that the timer stays readable. */
export const DIM_BRIGHTNESS = 0.15;
/** How long the screen waits without a touch before it dims. */
export const DIM_AFTER_MS = 5_000;

/**
 * Dims the screen while a timelapse records and nobody touches it, and puts the brightness back
 * on a touch, on stop, when the app leaves the foreground and when the screen closes. The app's
 * own brightness is what changes (expo-brightness), so it can never outlive the recording.
 * Where brightness can't be set (the web) only the dark recording view shows.
 */
export function useDimWhileRecording(recording: boolean) {
  const [dimmed, setDimmed] = useState(false);
  const saved = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const restore = useCallback(() => {
    setDimmed(false);
    const level = saved.current;
    saved.current = null;
    if (level !== null) void Brightness.setBrightnessAsync(level).catch(() => undefined);
  }, []);

  const dim = useCallback(async () => {
    setDimmed(true);
    try {
      if (!(await Brightness.isAvailableAsync())) return;
      if (saved.current === null) saved.current = await Brightness.getBrightnessAsync();
      await Brightness.setBrightnessAsync(DIM_BRIGHTNESS);
    } catch {
      // A phone that refuses still gets the dark recording view.
    }
  }, []);

  const arm = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => void dim(), DIM_AFTER_MS);
  }, [dim]);

  useEffect(() => {
    if (recording) arm();
    else restore();
    return clearTimer;
  }, [recording, arm, restore]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") restore();
    });
    return () => {
      subscription.remove();
      restore();
    };
  }, [restore]);

  /** Any touch brings the screen back up and starts the countdown again. */
  const wake = useCallback(() => {
    if (!recording) return;
    restore();
    arm();
  }, [recording, restore, arm]);

  return { dimmed, wake };
}
