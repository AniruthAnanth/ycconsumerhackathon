import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { haptics } from "@/lib/native/haptics";
import { isDone, justDone } from "@/lib/taskDone";
import { doneMoment } from "@/theme";

import { ease } from "./ease";
import { useReduceMotion } from "./useReduceMotion";

/** When each task last buzzed, so Roster and Matchup (both mounted under the tabs) buzz once for one proof. */
const lastBuzz = new Map<string, number>();
const BUZZ_DEDUPE_MS = 2_000;

type Options = {
  /** The task's id; the same task turning done on two screens buzzes once. */
  id?: string;
  /** Off for the opponent's side of a matchup: their proof is not the player's moment. */
  haptic?: boolean;
  /** The perfect week landed with this task: a heavier finish. */
  perfect?: boolean;
};

/**
 * Whether a task is done, and whether it should play the done sequence: only when its status
 * turns verified while it is on screen. The previous status lives in a ref, so a row that mounts
 * done (a list opening, a week browsed) shows its final state at once. A layout effect starts the
 * sequence before the first done frame paints, so the final state never flashes first.
 * Haptics live here so every place a task is listed plays the same beats; with Reduce Motion
 * there is no motion and one success haptic.
 */
export function useDoneMoment(status: string | undefined, { id, haptic = true, perfect = false }: Options = {}) {
  const reduceMotion = useReduceMotion();
  const previous = useRef(status);
  const [play, setPlay] = useState(false);

  useLayoutEffect(() => {
    if (justDone(previous.current, status)) setPlay(true);
    else if (!isDone(status)) setPlay(false);
    previous.current = status;
  }, [status]);

  useEffect(() => {
    if (!play || !haptic) return;
    const now = Date.now();
    if (id !== undefined) {
      if (now - (lastBuzz.get(id) ?? -Infinity) < BUZZ_DEDUPE_MS) return;
      lastBuzz.set(id, now);
    }
    if (reduceMotion) {
      haptics.success();
      return;
    }
    haptics.press("light");
    const timers = [setTimeout(haptics.success, doneMoment.pillDelayMs)];
    if (perfect) timers.push(setTimeout(haptics.perfect, doneMoment.shimmerDelayMs));
    return () => timers.forEach(clearTimeout);
    // The sequence is fixed once it starts; a later change to perfect must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  return { done: isDone(status), animate: play && !reduceMotion };
}

/**
 * The fade a done row's slot pill and subtitle take: to half opacity, after the strike has drawn
 * when the sequence plays, at once otherwise.
 */
export function useDoneDim(done: boolean, animate: boolean) {
  const opacity = useSharedValue(done ? doneMoment.mutedOpacity : 1);
  useEffect(() => {
    const target = done ? doneMoment.mutedOpacity : 1;
    opacity.value = animate
      ? withDelay(doneMoment.strikeDelayMs + doneMoment.strikeMs, withTiming(target, { duration: doneMoment.muteMs, easing: ease.standard }))
      : target;
  }, [animate, done, opacity]);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}
