import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Every tap the phone makes, in one place, so screens say what happened ("the stamp landed")
 * instead of picking a vibration. Screens never import expo-haptics directly.
 *
 * expo-haptics is inside Expo Go, so this works there too. On the web it would fall back to
 * navigator.vibrate, which buzzes laptops and Android browsers for no reason, so the web is silent.
 * A haptic is never worth an error: every call swallows failures (a simulator has no Taptic Engine).
 */
const enabled = Platform.OS === "ios" || Platform.OS === "android";
/** Settings' Haptics switch (lib/appPrefs): off silences every call below. */
let muted = false;

export function setHapticsEnabled(on: boolean) {
  muted = !on;
}

function fire(play: () => Promise<void>) {
  if (!enabled || muted) return;
  try {
    play().catch(() => {});
  } catch {}
}

/** A count-up ticks at most this often, so a score spinning at 60 fps reads as a ratchet, not a buzz. */
export const TICK_MS = 100;
let lastTick = -Infinity;
/** The gap between the heavy and light halves of the intro's L drop. */
const DROP_GAP_MS = 90;

/** Which press feedback a shared pressable gives; "none" when the action fires its own haptic. */
export type PressHaptic = "light" | "medium" | "none";

export const haptics = {
  /** The VERIFIED stamp landing: a heavy thud, like ink hitting paper. NOT VERIFIED gets the warning double-tap. */
  stamp(pass: boolean) {
    fire(() =>
      pass
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    );
  },
  /** The press feedback of a shared button or card. */
  press(kind: PressHaptic) {
    if (kind === "light") fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    if (kind === "medium") fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  /** One step of a score counting up: a rigid tick, throttled to TICK_MS. */
  tick(now: number = Date.now()) {
    if (now - lastTick < TICK_MS) return;
    lastTick = now;
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
  },
  /** The intro's L dropping into place: a heavy landing, then a light settle. */
  drop() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    setTimeout(() => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)), DROP_GAP_MS);
  },
  /** A tab, a league, a week or a picker changed: the light tick iOS uses for selection. */
  select() {
    fire(() => Haptics.selectionAsync());
  },
  /** Something the player committed to went through: Lock Lineup, a payment, a check-in. */
  success() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  /** A veto was raised or a veto vote cast: the warning double-tap, heavier than a selection, lighter than the stamp. */
  veto() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  /** Something the player tried did not go through. */
  error() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
  /** A light press, for long-press menus and swipe actions crossing their threshold. */
  tap() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
};
