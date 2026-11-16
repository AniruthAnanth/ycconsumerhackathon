import { useEffect, useState } from "react";
import { type LayoutChangeEvent, type StyleProp, StyleSheet, type TextLayoutEvent, type TextStyle, View } from "react-native";
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { BORDER, colors, doneMoment } from "@/theme";

import { ease } from "./ease";

type Line = TextLayoutEvent["nativeEvent"]["lines"][number];
type Segment = { x: number; y: number; width: number; before: number };

type Props = {
  children: string;
  done: boolean;
  animate: boolean;
  style: StyleProp<TextStyle>;
  numberOfLines?: number;
  accessibilityLabel?: string;
};

/**
 * A title that is struck through and muted once its task is done. Beat 2 of the done sequence
 * draws the strike left to right across every line, then fades the ink to muted; when it has
 * drawn, the overlay hands over to the text's own line-through, which wraps with the text.
 * Native platforms report each line's box; the web does not, so there the strike crosses the
 * middle of the title.
 */
export function StrikeThrough({ children, done, animate, style, numberOfLines, accessibilityLabel }: Props) {
  const [struck, setStruck] = useState(done && !animate);
  const [lines, setLines] = useState<Line[]>();
  const [box, setBox] = useState<{ width: number; height: number }>();
  const draw = useSharedValue(0);
  const mute = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    if (!done) {
      setStruck(false);
      mute.value = 0;
      return;
    }
    if (!animate) {
      setStruck(true);
      mute.value = 1;
      return;
    }
    setStruck(false);
    mute.value = 0;
    draw.value = 0;
    draw.value = withDelay(
      doneMoment.strikeDelayMs,
      withTiming(1, { duration: doneMoment.strikeMs, easing: ease.standard }, (finished) => {
        if (finished) scheduleOnRN(setStruck, true);
      }),
    );
    mute.value = withDelay(doneMoment.strikeDelayMs + doneMoment.strikeMs, withTiming(1, { duration: doneMoment.muteMs, easing: ease.standard }));
  }, [animate, done, draw, mute]);

  const ink = useAnimatedStyle(() => ({ color: interpolateColor(mute.value, [0, 1], [colors.text, colors.textMuted]) }));

  const shown = lines?.length ? lines.slice(0, numberOfLines ?? lines.length) : box ? [{ x: 0, y: 0, width: box.width, height: box.height }] : [];
  const total = shown.reduce((sum, line) => sum + line.width, 0);
  let before = 0;
  const segments: Segment[] = shown.map((line) => {
    const segment = { x: line.x, y: line.y + line.height / 2, width: line.width, before };
    before += line.width;
    return segment;
  });

  return (
    <View>
      <Animated.Text
        style={[style, ink, struck && styles.struck]}
        numberOfLines={numberOfLines}
        accessibilityLabel={accessibilityLabel}
        onTextLayout={animate ? (event) => setLines(event.nativeEvent.lines) : undefined}
        onLayout={animate ? (event: LayoutChangeEvent) => setBox(event.nativeEvent.layout) : undefined}
      >
        {children}
      </Animated.Text>
      {animate && !struck
        ? segments.map((segment, index) => <StrikeSegment key={index} segment={segment} total={total} draw={draw} />)
        : null}
    </View>
  );
}

/** One line's share of the strike: it starts drawing once the lines before it are crossed. */
function StrikeSegment({ segment, total, draw }: { segment: Segment; total: number; draw: SharedValue<number> }) {
  const grow = useAnimatedStyle(() => ({
    width: Math.min(segment.width, Math.max(0, draw.value * total - segment.before)),
  }));
  return <Animated.View pointerEvents="none" style={[styles.segment, { left: segment.x, top: segment.y }, grow]} />;
}

const styles = StyleSheet.create({
  struck: { textDecorationLine: "line-through", textDecorationColor: colors.textMuted },
  segment: { position: "absolute", height: BORDER, backgroundColor: colors.textMuted },
});
