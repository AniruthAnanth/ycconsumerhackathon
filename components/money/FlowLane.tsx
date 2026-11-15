import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { Easing, type SharedValue, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { BORDER, colors, fontFamily } from "@/theme";

import { type Curve, curvePoint } from "./escrowLayout";
import { coinProgress, COINS_PER_MEMBER, LANE_MS } from "./escrowTimeline";
import type { LanePlay } from "./useEscrowPlayback";

const COIN_SIZE = 16;

type Props = {
  curve: Curve;
  /** Set, or given a new token, when this member's dollars should fly. */
  play?: LanePlay;
  /** Reduce Motion: the dollars are already in the pot. */
  still: boolean;
};

/**
 * One member's dollars travelling along their curve into the pot. Each dollar is a plain view
 * moved by a transform, not an animated SVG node, because that is the one way that behaves the
 * same in Expo Go on both platforms and on the web.
 */
export function FlowLane({ curve, play, still }: Props) {
  // 1 is every dollar landed, which is also how a lane that has never played rests.
  const progress = useSharedValue(1);
  const token = play?.token;
  const delayMs = play?.delayMs ?? 0;

  useEffect(() => {
    if (token === undefined || still) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    // Linear here: each dollar eases along its own stretch of the lane in Coin.
    progress.value = withDelay(delayMs, withTiming(1, { duration: LANE_MS, easing: Easing.linear }));
  }, [token, delayMs, still, progress]);

  return (
    <>
      {Array.from({ length: COINS_PER_MEMBER }, (_, index) => (
        <Coin key={index} curve={curve} index={index} progress={progress} />
      ))}
    </>
  );
}

function Coin({ curve, index, progress }: { curve: Curve; index: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = coinProgress(progress.value, index);
    // Ease-out: quick off the avatar, slowing as it reaches the pot.
    const eased = 1 - Math.pow(1 - t, 3);
    const point = curvePoint(curve, eased);
    return {
      // Hidden while waiting and once landed; in between it fades in fast and sinks into the pot.
      opacity: t <= 0 || t >= 1 ? 0 : Math.min(1, t * 8, (1 - t) * 5),
      transform: [
        { translateX: point.x - COIN_SIZE / 2 },
        { translateY: point.y - COIN_SIZE / 2 },
        { scale: 1 - 0.25 * eased },
      ],
    };
  }, [curve, index]);

  return (
    <Animated.View style={[styles.coin, style]}>
      <Text style={styles.sign}>$</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  coin: {
    position: "absolute",
    left: 0,
    top: 0,
    width: COIN_SIZE,
    height: COIN_SIZE,
    borderRadius: COIN_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
    borderWidth: BORDER,
    borderColor: colors.accent,
    pointerEvents: "none",
  },
  sign: { fontFamily: fontFamily.extraBold, fontSize: 10, lineHeight: 13, color: colors.accent },
});
