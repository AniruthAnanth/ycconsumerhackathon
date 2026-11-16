import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { haptics, type PressHaptic } from "@/lib/native/haptics";
import { PRESS_SCALE } from "@/lib/native/motion";
import { spring } from "@/theme";

import { useReduceMotion } from "./useReduceMotion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** The tap felt on press; "none" when onPress fires its own haptic (a veto, a lock). */
  haptic?: PressHaptic;
};

/**
 * A Pressable that sinks slightly under the finger and springs back, so every button and card
 * answers a touch the same way. Everything else (labels, roles, testIDs) passes straight through.
 * With Reduce Motion it stays still. A press also gives a light tap unless haptic says otherwise.
 */
export function PressScale({ style, onPress, onPressIn, onPressOut, haptic = "light", ...pressable }: Props) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...pressable}
      style={[style, animated]}
      onPress={
        onPress &&
        ((event) => {
          haptics.press(haptic);
          onPress(event);
        })
      }
      onPressIn={(event) => {
        if (!reduceMotion) scale.value = withSpring(PRESS_SCALE, spring.snappy);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = reduceMotion ? 1 : withSpring(1, spring.snappy);
        onPressOut?.(event);
      }}
    />
  );
}
