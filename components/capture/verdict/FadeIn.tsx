import { useEffect, useRef, type ReactNode } from "react";
import { Animated } from "react-native";

type Props = { delay: number; children: ReactNode };

export function FadeIn({ delay, children }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 280, delay, useNativeDriver: true }).start();
  }, [delay, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  return <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>;
}
