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

function fire(play: () => Promise<void>) {
  if (!enabled) return;
  play().catch(() => {});
}

export const haptics = {
  /** The VERIFIED stamp landing: a heavy thud, like ink hitting paper. NOT VERIFIED gets the error buzz. */
  stamp(pass: boolean) {
    fire(() =>
      pass
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    );
  },
  /** A tab, a league, a week or a picker changed: the light tick iOS uses for selection. */
  select() {
    fire(() => Haptics.selectionAsync());
  },
  /** Something the player committed to went through: Lock Lineup, a payment, a check-in. */
  success() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
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
