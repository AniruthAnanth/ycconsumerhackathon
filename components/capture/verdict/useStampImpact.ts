import { useCallback, useEffect, useRef } from "react";
import { Animated } from "react-native";

import { useReduceMotion } from "@/components/motion";
import { haptics } from "@/lib/native/haptics";
import { duration } from "@/theme";

const SHAKE_OFFSETS = [8, -8, 6, -5, 3, 0];
// Six steps inside one fast beat, so the shake reads as a single jolt.
const SHAKE_STEP_MS = duration.fast / 3;

/**
 * Shakes the screen and thuds the phone when the stamp lands; `pass` is undefined while there is
 * no verdict. `land` is the stamp's onLand. It acts once per verdict, because the stamp can call it
 * again when Reduce Motion is read after the slam started. With Reduce Motion on the haptic still
 * fires but the screen stays still.
 */
export function useStampImpact(pass: boolean | undefined) {
  const reduceMotion = useReduceMotion();
  const offset = useRef(new Animated.Value(0)).current;
  const landed = useRef(false);

  useEffect(() => {
    if (pass === undefined) landed.current = false;
  }, [pass]);

  const land = useCallback(() => {
    if (pass === undefined || landed.current) return;
    landed.current = true;
    haptics.stamp(pass);
    if (reduceMotion) return;
    Animated.sequence(
      SHAKE_OFFSETS.map((toValue) => Animated.timing(offset, { toValue, duration: SHAKE_STEP_MS, useNativeDriver: true })),
    ).start();
  }, [offset, pass, reduceMotion]);

  return { style: { transform: [{ translateX: offset }] }, land };
}
