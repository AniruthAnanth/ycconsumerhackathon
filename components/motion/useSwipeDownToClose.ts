import { usePanGesture } from "react-native-gesture-handler";
import { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { shouldDismiss } from "@/lib/native/swipeDismiss";
import { spring } from "@/theme";

/**
 * Swipe down to close a full-screen modal (the camera, Wrapped): the screen follows the finger and,
 * past the shared threshold, `onClose` runs and the native modal slides the rest of the way.
 * When `asksFirst` is set (a capture in progress), the screen springs back instead and `onClose`
 * is expected to ask before it leaves. The pan only claims vertical drags, so taps and horizontal
 * paging underneath keep working.
 */
export function useSwipeDownToClose(onClose: () => void, asksFirst = false) {
  const dragY = useSharedValue(0);
  const gesture = usePanGesture({
    activeOffsetY: 12,
    failOffsetX: [-16, 16],
    onUpdate: (event) => {
      dragY.value = Math.max(0, event.translationY);
    },
    onDeactivate: (event) => {
      const leaving = shouldDismiss(event.translationY, event.velocityY);
      if (!leaving || asksFirst) dragY.value = withSpring(0, spring.snappy);
      if (leaving) scheduleOnRN(onClose);
    },
  });
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));
  return { gesture, style };
}
