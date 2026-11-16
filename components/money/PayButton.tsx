import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useReduceMotion } from "@/components/motion";
import { Icon } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, MIN_TARGET, status } from "@/theme";

import { usePayBuyIn } from "./usePayBuyIn";

/** One full breath of the badge dot. */
const PULSE_MS = 2_000;
/** The card-to-check morph once the buy-in lands, before the button leaves. */
const CHECK_MS = 600;
const LEAVE_MS = 200;

/**
 * The header's pay prompt: a card with a pulsing red dot while the player owes the
 * selected league's buy-in. When Whop's webhook marks it paid, the card turns into a
 * green check and the button leaves. Free leagues never show it.
 *
 * It follows the header's league, or `leagueId` on a screen about one league, such as a versus home.
 */
export function PayButton({ leagueId }: { leagueId?: Id<"leagues"> }) {
  const current = useCurrentLeague();
  const membership = leagueId ? current.me?.leagues.find((league) => league._id === leagueId) : current.membership;
  const reduceMotion = useReduceMotion();
  const owes = membership !== undefined && membership.stakeUsd > 0 && !membership.paid;
  // The league this button last asked to be paid, so a flip to paid there (and only there) earns the check.
  const [owedId, setOwedId] = useState<Id<"leagues"> | null>(null);
  if (owes && owedId !== membership._id) setOwedId(membership._id);
  if (!owes && owedId !== null && owedId !== membership?._id) setOwedId(null);
  const justPaid = !owes && owedId !== null && membership?.paid === true;
  useEffect(() => {
    if (justPaid && reduceMotion) setOwedId(null);
  }, [justPaid, reduceMotion]);
  const clear = useCallback(() => setOwedId(null), []);

  if (owes) return <PayCard key={membership._id} leagueId={membership._id} stakeUsd={membership.stakeUsd} />;
  if (justPaid && !reduceMotion) return <PaidCheck onDone={clear} />;
  return null;
}

function PayCard({ leagueId, stakeUsd }: { leagueId: Id<"leagues">; stakeUsd: number }) {
  const { pay, opening } = usePayBuyIn(leagueId);
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0;
      return;
    }
    const half = { duration: PULSE_MS / 2, easing: Easing.inOut(Easing.sin) };
    pulse.value = withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1);
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);
  const dotStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value * 0.35,
    transform: [{ scale: 1 + pulse.value * 0.25 }],
  }));

  return (
    <Pressable
      onPress={() => void pay()}
      disabled={opening}
      style={styles.target}
      accessibilityRole="button"
      accessibilityLabel={`Pay $${stakeUsd} buy-in`}
      accessibilityState={{ busy: opening, disabled: opening }}
      testID="pay-buyin-button"
    >
      <View style={styles.glyph}>
        {opening ? <ActivityIndicator size="small" color={colors.accent} /> : <Icon name="card-outline" size={24} />}
        <Animated.View style={[styles.dot, dotStyle]} />
      </View>
    </Pressable>
  );
}

function PaidCheck({ onDone }: { onDone: () => void }) {
  const morph = useSharedValue(0);
  const leave = useSharedValue(0);
  useEffect(() => {
    morph.value = withTiming(1, { duration: CHECK_MS, easing: Easing.out(Easing.cubic) });
    leave.value = withDelay(
      CHECK_MS,
      withTiming(1, { duration: LEAVE_MS }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      }),
    );
  }, [morph, leave, onDone]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, morph.value * 2),
    transform: [{ scale: 1 - morph.value * 0.4 }],
  }));
  // The pop: up past full size halfway through, settling back at the end.
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, morph.value * 2),
    transform: [{ scale: 0.5 + morph.value * 0.5 + Math.sin(morph.value * Math.PI) * 0.3 }],
  }));
  const wholeStyle = useAnimatedStyle(() => ({ opacity: 1 - leave.value }));

  return (
    <Animated.View style={[styles.target, wholeStyle]} accessibilityLabel="Buy-in paid" accessible>
      <View style={styles.glyph}>
        <Animated.View style={cardStyle}>
          <Icon name="card-outline" size={24} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, checkStyle]}>
          <Icon name="checkmark-circle" size={26} color={status.verified} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const DOT = 10;

const styles = StyleSheet.create({
  target: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, alignItems: "center", justifyContent: "center" },
  glyph: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", justifyContent: "center" },
  dot: {
    position: "absolute",
    top: 0,
    right: -2,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: status.danger,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
