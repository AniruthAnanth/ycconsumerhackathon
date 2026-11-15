import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { PRESS_SCALE, SPRING } from "@/lib/native/motion";

import { useReduceMotion } from "./useReduceMotion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> };

/**
 * A Pressable that sinks slightly under the finger and springs back, so every button and card
 * answers a touch the same way. Everything else (labels, roles, testIDs) passes straight through.
 * With Reduce Motion it stays still.
 */
export function PressScale({ style, onPressIn, onPressOut, ...pressable }: Props) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...pressable}
      style={[style, animated]}
      onPressIn={(event) => {
        if (!reduceMotion) scale.value = withSpring(PRESS_SCALE, SPRING);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = reduceMotion ? 1 : withSpring(1, SPRING);
        onPressOut?.(event);
      }}
    />
  );
}
