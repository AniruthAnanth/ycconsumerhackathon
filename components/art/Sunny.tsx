import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";

import { useReduceMotion } from "@/components/motion";

import { between, blinkPlan, flickPlan, wander } from "./sunnyMotion";
import { SUNNY_EYES, SUNNY_FACE, SUNNY_PARTS } from "./sunnyParts";

/**
 * idle: breathing and glancing about. listening: head tilted, ears up. thinking: quicker breath and
 * a searching sway. waiting: slow, sleepy, lids heavy. success: one hop, then back to idle.
 */
export type SunnyMood = "idle" | "listening" | "thinking" | "waiting" | "success";

type Props = {
  size: number;
  mood?: SunnyMood;
  /** Pop in with a spring on mount. */
  entrance?: boolean;
  /** React to a tap with a squash, a hop and an ear flick. Leave off inside another pressable. */
  tappable?: boolean;
  /** Delay before the entrance (and a success hop) starts, in ms. */
  delay?: number;
};

const EASE = Easing.inOut(Easing.sin);
const SOFT = { damping: 14, stiffness: 140, mass: 1 };
const BOUNCY = { damping: 9, stiffness: 220, mass: 0.9 };

function loop(steps: ReturnType<typeof wander>, spring: boolean) {
  const moves = steps.map((s) => (spring ? withSpring(s.to, SOFT) : withTiming(s.to, { duration: s.ms, easing: EASE })));
  return withRepeat(withSequence(...moves), -1, false);
}

function blinkLoop(plan: ReturnType<typeof blinkPlan>) {
  const blinks = plan.flatMap((b) => {
    const one = [
      withDelay(b.wait, withTiming(1, { duration: b.close })),
      withTiming(0, { duration: b.open }),
    ];
    return b.double ? [...one, withDelay(120, withTiming(1, { duration: b.close })), withTiming(0, { duration: b.open })] : one;
  });
  return withRepeat(withSequence(...blinks), -1, false);
}

function flickLoop(plan: ReturnType<typeof flickPlan>) {
  const flicks = plan.flatMap((f) => [
    withDelay(f.wait, withTiming(f.amount, { duration: f.ms, easing: Easing.out(Easing.quad) })),
    withSpring(0, { damping: 6, stiffness: 260, mass: 0.5 }),
  ]);
  return withRepeat(withSequence(...flicks), -1, false);
}

function Ear({ xml, size, flick, lift, droop, side, origin }: { xml: string; size: number; flick: SharedValue<number>; lift: SharedValue<number>; droop: SharedValue<number>; side: 1 | -1; origin: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${flick.value + side * (lift.value * 7 - droop.value * 9)}deg` }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin }, style]}>
      <SvgXml xml={xml} width={size} height={size} />
    </Animated.View>
  );
}

/**
 * The Sunny mascot, alive. Every layer (breath, weight shift, head tilt, each ear, the lids) runs
 * as its own reanimated worklet on the UI thread with its own randomly timed steps. Reduce Motion
 * leaves the plain drawing.
 */
export function Sunny({ size, mood = "idle", entrance = true, tappable = false, delay = 0 }: Props) {
  const reduceMotion = useReduceMotion();
  const k = size / 400;

  const plan = useMemo(
    () => ({
      shift: wander(Math.random, 9, 1, 1800, 4200),
      tilt: wander(Math.random, 11, 1, 1400, 3600),
      blink: blinkPlan(Math.random, 8),
      leftFlick: flickPlan(Math.random, 6),
      rightFlick: flickPlan(Math.random, 6),
      breath: Array.from({ length: 10 }, (_, i) => ({ to: i % 2 === 0 ? between(Math.random, 0.7, 1) : between(Math.random, 0, 0.15), ms: between(Math.random, 1500, 2300) })),
    }),
    [],
  );

  const intro = useSharedValue(entrance && !reduceMotion ? 0 : 1);
  const breath = useSharedValue(0);
  const shift = useSharedValue(0);
  const tilt = useSharedValue(0);
  const lid = useSharedValue(0);
  const leftEar = useSharedValue(0);
  const rightEar = useSharedValue(0);
  const hop = useSharedValue(0);
  const squash = useSharedValue(0);
  const energy = useSharedValue(1);
  const lean = useSharedValue(0);
  const droop = useSharedValue(0);
  const earLift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    if (entrance) intro.value = withDelay(delay, withSpring(1, BOUNCY));
    breath.value = loop(plan.breath, false);
    shift.value = loop(plan.shift, true);
    tilt.value = loop(plan.tilt, true);
    lid.value = blinkLoop(plan.blink);
    leftEar.value = flickLoop(plan.leftFlick);
    rightEar.value = flickLoop(plan.rightFlick);
    return () => [intro, breath, shift, tilt, lid, leftEar, rightEar].forEach(cancelAnimation);
  }, [reduceMotion, entrance, delay, plan, intro, breath, shift, tilt, lid, leftEar, rightEar]);

  useEffect(() => {
    if (reduceMotion) return;
    const calm = mood === "waiting";
    energy.value = withTiming(mood === "thinking" ? 1.8 : calm ? 0.55 : 1, { duration: 600 });
    lean.value = withSpring(mood === "listening" ? -1 : mood === "thinking" ? 0.5 : 0, SOFT);
    droop.value = withTiming(calm ? 1 : 0, { duration: 900 });
    earLift.value = withSpring(mood === "listening" ? 1 : 0, SOFT);
    if (mood !== "success") return;
    hop.value = withDelay(
      delay + 250,
      withSequence(
        withTiming(0, { duration: 1 }),
        withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 7, stiffness: 170, mass: 0.8 }),
      ),
    );
    squash.value = withDelay(
      delay + 250,
      withSequence(withTiming(1, { duration: 120 }), withTiming(-0.6, { duration: 140 }), withSpring(0, { damping: 6, stiffness: 200, mass: 0.7 })),
    );
  }, [mood, reduceMotion, delay, energy, lean, droop, earLift, hop, squash]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, intro.value * 2),
    transform: [{ translateY: (1 - intro.value) * size * 0.12 - hop.value * size * 0.18 }, { scale: 0.6 + 0.4 * intro.value }],
  }));

  const bodyStyle = useAnimatedStyle(() => {
    const b = breath.value * energy.value;
    const sy = 1 + 0.016 * b - 0.05 * squash.value - 0.02 * droop.value + 0.04 * hop.value;
    const sx = 1 - 0.007 * b + 0.04 * squash.value - 0.02 * hop.value;
    return {
      transform: [
        { translateX: shift.value * size * 0.012 },
        { rotate: `${shift.value * 1.1 + tilt.value * 1.6 * energy.value + lean.value * 5 + droop.value * 3}deg` },
        { scaleX: sx },
        { scaleY: sy },
      ],
    };
  });

  const lidStyle = useAnimatedStyle(() => ({ opacity: Math.max(lid.value, droop.value * 0.55) }));

  const flick = () => {
    if (reduceMotion) return;
    hop.value = withSequence(withTiming(0.5, { duration: 110, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 8, stiffness: 200, mass: 0.8 }));
    squash.value = withSequence(withTiming(0.8, { duration: 70 }), withSpring(0, { damping: 6, stiffness: 220, mass: 0.7 }));
    leftEar.value = withSequence(withTiming(-12, { duration: 80 }), withSpring(0, { damping: 5, stiffness: 240, mass: 0.5 }));
    rightEar.value = withSequence(withTiming(12, { duration: 80 }), withSpring(0, { damping: 5, stiffness: 240, mass: 0.5 }));
  };

  const figure = (
    <Animated.View style={[{ width: size, height: size }, rootStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: "50% 92%" }, bodyStyle]}>
        <Ear xml={SUNNY_PARTS.leftEar} size={size} flick={leftEar} lift={earLift} droop={droop} side={-1} origin={`${178 * k}px ${95 * k}px`} />
        <Ear xml={SUNNY_PARTS.rightEar} size={size} flick={rightEar} lift={earLift} droop={droop} side={1} origin={`${244 * k}px ${88 * k}px`} />
        <SvgXml xml={SUNNY_PARTS.body} width={size} height={size} />
        <Animated.View style={[StyleSheet.absoluteFill, lidStyle]} pointerEvents="none">
          {SUNNY_EYES.map((eye) => (
            <View
              key={eye.x}
              style={{
                position: "absolute",
                left: (eye.x - eye.rx - 1) * k,
                top: (eye.y - eye.ry - 1) * k,
                width: (eye.rx * 2 + 2) * k,
                height: (eye.ry * 2 + 2) * k,
                borderRadius: eye.rx * k + k,
                backgroundColor: SUNNY_FACE,
              }}
            />
          ))}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );

  return (
    <View
      style={{ width: size, height: size }}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      pointerEvents={tappable ? "auto" : "none"}
    >
      {tappable ? <Pressable onPress={flick}>{figure}</Pressable> : figure}
    </View>
  );
}

