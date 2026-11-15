import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * True when the player turned on Reduce Motion. Every component in components/motion checks it
 * and lands on its final state at once instead of animating.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
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
  return reduce;
}
