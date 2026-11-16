import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { useAppPrefs } from "@/lib/appPrefs";

/**
 * True when the player turned on Reduce Motion, in the system or in Settings' App section. Every
 * component in components/motion checks it and lands on its final state at once instead of
 * animating.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  const { reduceMotion } = useAppPrefs();
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => live && setReduce(value))
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduce || reduceMotion === "on";
}
