import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Animated } from "react-native";

import { IMPACT_DELAY_MS } from "./timing";

const SHAKE_OFFSETS = [8, -8, 6, -5, 3, 0];

/** Shakes the screen and taps the phone as the stamp lands; `pass` is undefined while there is no verdict. */
export function useStampImpact(pass: boolean | undefined) {
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pass === undefined) return;
    const timer = setTimeout(() => {
      void Haptics.notificationAsync(
        pass ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      );
      Animated.sequence(
        SHAKE_OFFSETS.map((toValue) => Animated.timing(offset, { toValue, duration: 40, useNativeDriver: true })),
      ).start();
    }, IMPACT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [offset, pass]);

  return { transform: [{ translateX: offset }] };
}
