import { useEffect, useState } from "react";
import {
  type LayoutRectangle,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Artwork } from "@/components/art";
import { ease, useReduceMotion } from "@/components/motion";
import { haptics } from "@/lib/native/haptics";
import { colors, duration, fontFamily, spacing, spring, type } from "@/theme";

const SUNNY = 112;
const LETTER = 76;
const HOP = duration.slow;
const LAND = duration.fast;
/** Three hops, each lower than the last, the way something bouncy runs out of spring. */
const HOP_HEIGHTS = [96, 72, 48];
const HOPS_END = HOP_HEIGHTS.length * (HOP + LAND);
const LOOK_END = HOPS_END + duration.base;
const DROP_END = LOOK_END + HOP;
const POP_START = DROP_END + duration.base;
const POP_END = POP_START + HOP;
const TAGLINE_END = POP_END + duration.base;
/** "Tap to start" arrives about a second after everything has landed. */
const PROMPT_AT = TAGLINE_END + duration.slow * 3;
/** One slow breath, one slow pulse: the idle pose, held until the player taps. */
const BREATH = duration.slow * 5;
const SHIMMER = duration.slow * 4;

/**
 * The opening before "How Lineup works", in the spirit of the Pixar lamp: Sunny hops in, looks up,
 * the L of Lineup lands on Sunny with a squash and a puff of dust, Sunny pops out none the worse
 * and climbs on top, and the rest of the word slides in under the tagline. About three seconds, then it
 * holds that pose with Sunny breathing and a light passing over the word until the player taps
 * anywhere ("Tap to start"). A tap earlier skips straight on; Reduce Motion shows the last frame.
 */
export function Opening({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReduceMotion();
  // Where the L sits in the finished word, measured once, so Sunny can stand exactly under it.
  const [row, setRow] = useState<LayoutRectangle | null>(null);
  const [letter, setLetter] = useState<LayoutRectangle | null>(null);
  const [stage, setStage] = useState<{ width: number; height: number } | null>(
    null,
  );

  const sunnyX = useSharedValue(0);
  const sunnyY = useSharedValue(0);
  const stretch = useSharedValue(1);
  const tilt = useSharedValue(0);
  // Far above any screen until the run sets the real start, so the L never shows before it falls.
  const dropY = useSharedValue(-10_000);
  const letterSquash = useSharedValue(1);
  const dust = useSharedValue(0);
  const rest = useSharedValue(0);
  const tagline = useSharedValue(0);
  const breath = useSharedValue(1);
  const shimmer = useSharedValue(0);
  const prompt = useSharedValue(0);
  const leaving = useSharedValue(1);
  const [left, setLeft] = useState(false);

  const ready = row && letter && stage;
  // Sunny's two marks, as offsets from the centre of the stage: under the L, and on top of the word.
  const underL = ready
    ? row.x + letter.x + letter.width / 2 - stage.width / 2
    : 0;
  const onTopY = ready ? -row.height : 0;

  useEffect(() => {
    if (!ready) return;
    if (reduceMotion) {
      sunnyY.value = onTopY;
      dropY.value = 0;
      sunnyX.value = 0;
      rest.value = 1;
      tagline.value = 1;
      prompt.value = 1;
      return;
    }
    const start = -(stage.width / 2 + SUNNY);
    const step = (underL - start) / HOP_HEIGHTS.length;
    const hold = (value: number, ms: number) =>
      withTiming(value, { duration: ms });

    sunnyX.value = start;
    sunnyX.value = withSequence(
      ...HOP_HEIGHTS.flatMap((_, i) => [
        withTiming(start + step * (i + 1), {
          duration: HOP,
          easing: Easing.linear,
        }),
        hold(start + step * (i + 1), LAND),
      ]),
      hold(underL, DROP_END + duration.base - HOPS_END),
      // Pops out from under the L and climbs on top of the word.
      withTiming(0, { duration: HOP, easing: ease.standard }),
    );
    sunnyY.value = withSequence(
      ...HOP_HEIGHTS.flatMap((height) => [
        withTiming(-height, {
          duration: HOP / 2,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0, { duration: HOP / 2, easing: Easing.in(Easing.quad) }),
        hold(0, LAND),
      ]),
      hold(0, POP_START - HOPS_END),
      withTiming(onTopY - HOP_HEIGHTS[0], {
        duration: HOP / 2,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(onTopY, { duration: HOP / 2, easing: Easing.in(Easing.quad) }),
    );
    // Stretch on the way up, squash on each landing; flattened by the L, then a spring back to shape.
    stretch.value = withSequence(
      ...HOP_HEIGHTS.flatMap(() => [
        hold(1.12, HOP / 2),
        hold(1, HOP / 2),
        hold(0.72, LAND / 2),
        hold(1, LAND / 2),
      ]),
      hold(1, DROP_END - HOPS_END),
      hold(0.3, LAND / 2),
      hold(0.3, POP_START - DROP_END - LAND / 2),
      withSpring(1, spring.snappy),
    );
    tilt.value = withDelay(
      HOPS_END,
      withSequence(
        withTiming(-14, { duration: duration.base, easing: ease.standard }),
        withDelay(POP_START - LOOK_END, withSpring(0, spring.snappy)),
      ),
    );

    dropY.value = -stage.height;
    // A falling letter speeds up, so the drop eases in and the landing does the emphasis.
    dropY.value = withDelay(
      LOOK_END,
      withTiming(
        0,
        { duration: HOP, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(haptics.drop)();
        },
      ),
    );
    letterSquash.value = withDelay(
      DROP_END,
      withSequence(
        withTiming(0.82, { duration: LAND / 2 }),
        withSpring(1, spring.gentle),
      ),
    );
    dust.value = withDelay(
      DROP_END,
      withTiming(1, { duration: duration.slow * 2, easing: ease.emphasized }),
    );
    rest.value = withDelay(
      POP_START,
      withTiming(1, { duration: HOP, easing: ease.emphasized }),
    );
    tagline.value = withDelay(
      POP_END,
      withTiming(1, { duration: duration.base, easing: ease.standard }),
    );

    // The held pose: a slow breath on Sunny, a light across the word every few seconds, and the
    // prompt pulsing gently. No timer moves on; only a tap does.
    breath.value = withDelay(
      TAGLINE_END,
      withRepeat(
        withSequence(
          withTiming(1.03, { duration: BREATH, easing: ease.standard }),
          withTiming(1, { duration: BREATH, easing: ease.standard }),
        ),
        -1,
      ),
    );
    shimmer.value = withDelay(
      TAGLINE_END,
      withRepeat(
        withSequence(
          withTiming(1, { duration: SHIMMER, easing: ease.standard }),
          withTiming(1, { duration: SHIMMER }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    prompt.value = withDelay(
      PROMPT_AT,
      withSequence(
        withTiming(1, { duration: duration.slow, easing: ease.standard }),
        withRepeat(
          withSequence(
            withTiming(0.45, { duration: BREATH }),
            withTiming(1, { duration: BREATH }),
          ),
          -1,
        ),
      ),
    );
    // The shared values are stable; the run starts once, when the word has been measured.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, reduceMotion]);

  const sunnyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: sunnyX.value },
      { translateY: sunnyY.value },
      { scaleY: stretch.value * breath.value },
      // Volume stays roughly constant: thinner when stretched, wider when squashed.
      { scaleX: breath.value / Math.sqrt(stretch.value) },
      { rotate: `${tilt.value}deg` },
    ],
  }));
  const letterStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dropY.value }, { scaleY: letterSquash.value }],
  }));
  const restStyle = useAnimatedStyle(() => ({
    opacity: rest.value,
    transform: [{ translateX: (1 - rest.value) * LETTER }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: tagline.value }));
  const promptStyle = useAnimatedStyle(() => ({ opacity: prompt.value }));
  const screenStyle = useAnimatedStyle(() => ({ opacity: leaving.value }));
  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value > 0 && shimmer.value < 1 ? 0.2 : 0,
    transform: [
      { translateX: (row?.width ?? 0) * (shimmer.value * 1.4 - 0.2) },
      { skewX: "-20deg" },
    ],
  }));

  // A light tap, then a quick fade into the cards.
  function start() {
    if (left) return;
    setLeft(true);
    haptics.select();
    leaving.value = withTiming(
      0,
      { duration: duration.base, easing: ease.standard },
      (finished) => {
        if (finished) runOnJS(onDone)();
      },
    );
  }
  const puffLeft = useAnimatedStyle(() => ({
    opacity: dust.value === 0 ? 0 : 1 - dust.value,
    transform: [
      { translateX: -dust.value * LETTER * 0.6 },
      { translateY: -dust.value * spacing.md },
      { scale: 0.4 + dust.value },
    ],
  }));
  const puffRight = useAnimatedStyle(() => ({
    opacity: dust.value === 0 ? 0 : 1 - dust.value,
    transform: [
      { translateX: dust.value * LETTER * 0.6 },
      { translateY: -dust.value * spacing.md },
      { scale: 0.4 + dust.value },
    ],
  }));

  return (
    <Pressable
      style={styles.screen}
      onPress={start}
      onLayout={(event) => setStage(event.nativeEvent.layout)}
      accessibilityRole="button"
      accessibilityLabel="Lineup. A fantasy league for your own life. Tap to start."
      testID="opening"
    >
      <Animated.View style={[styles.centre, screenStyle]}>
        {/* Behind the word, so the L lands in front of Sunny. Feet on the word's baseline (the drawing's
            feet sit at 88% of its height), so squash and stretch happen at the feet. */}
        <Animated.View
          style={[
            styles.sunny,
            ready
              ? {
                  top: row.y + row.height - SUNNY * 0.88,
                  left: stage.width / 2 - SUNNY / 2,
                }
              : styles.hidden,
            sunnyStyle,
          ]}
        >
          <Artwork name="sunny" size={SUNNY} />
        </Animated.View>
        <View
          style={styles.word}
          onLayout={(event) => setRow(event.nativeEvent.layout)}
        >
          <Animated.Text
            style={[styles.letter, styles.drop, letterStyle]}
            onLayout={(event) => setLetter(event.nativeEvent.layout)}
          >
            L
          </Animated.Text>
          <Animated.Text style={[styles.letter, restStyle]}>
            ineup
          </Animated.Text>
          {letter ? (
            <>
              <Animated.View
                style={[styles.puff, { left: letter.x - spacing.md }, puffLeft]}
              />
              <Animated.View
                style={[
                  styles.puff,
                  { left: letter.x + letter.width - spacing.md },
                  puffRight,
                ]}
              />
            </>
          ) : null}
        </View>
        {/* A light passing over the finished word, in its own clipped frame so the falling L is never clipped. */}
        {row ? (
          <View
            pointerEvents="none"
            style={[
              styles.shimmerFrame,
              { left: row.x, top: row.y, width: row.width, height: row.height },
            ]}
          >
            <Animated.View style={[styles.shimmer, shimmerStyle]} />
          </View>
        ) : null}
        <Animated.Text style={[styles.tagline, taglineStyle]}>
          A fantasy league for your own life
        </Animated.Text>
        <Animated.Text style={[styles.prompt, promptStyle]}>
          Tap to start
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  word: { flexDirection: "row", alignItems: "flex-end" },
  letter: {
    fontFamily: fontFamily.extraBold,
    fontSize: LETTER,
    lineHeight: LETTER * 1.1,
    color: colors.accent,
  },
  drop: { zIndex: 1, transformOrigin: "bottom" },
  puff: {
    position: "absolute",
    bottom: 0,
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: spacing.xl,
    backgroundColor: colors.divider,
  },
  sunny: {
    position: "absolute",
    width: SUNNY,
    height: SUNNY,
    transformOrigin: "50% 88%",
  },
  hidden: { opacity: 0 },
  tagline: { ...type.body, color: colors.textMuted, marginTop: spacing.lg },
  prompt: {
    ...type.label,
    color: colors.accent,
    position: "absolute",
    bottom: spacing.xxl * 2,
  },
  shimmerFrame: { position: "absolute", overflow: "hidden" },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: LETTER / 2,
    backgroundColor: colors.surface,
    opacity: 0.35,
  },
});
