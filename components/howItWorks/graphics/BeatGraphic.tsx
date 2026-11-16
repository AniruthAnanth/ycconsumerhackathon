import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { CountUp, ease, useReduceMotion } from "@/components/motion";
import { Avatar, Icon } from "@/components/ui";
import { colors, duration, font, fontFamily, radius, spacing, type } from "@/theme";

const YOU_SCORE = 128;
const MAYA_SCORE = 104;
const formatPoints = (value: number) => String(value);

/** Fades and rises its child into place after a wait; with animate off it is simply there. */
function Rise({ animate, delay, children }: { animate: boolean; delay: number; children: React.ReactNode }) {
  const shown = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) shown.value = withDelay(delay, withTiming(1, { duration: duration.slow, easing: ease.emphasized }));
  }, [animate, delay, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: 16 * (1 - shown.value) }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function Side({ name, score, animate, delay }: { name: string; score: number; animate: boolean; delay: number }) {
  return (
    <View style={styles.side}>
      <Avatar name={name} size={48} />
      <Text style={styles.name}>{name}</Text>
      <CountUp style={styles.score} value={score} format={formatPoints} fromZero={animate} delay={delay} />
    </View>
  );
}

function Scene({ animate }: { animate: boolean }) {
  return (
    <View style={styles.scene}>
      <View style={styles.card}>
        <Side name="You" score={YOU_SCORE} animate={animate} delay={duration.base} />
        <Text style={styles.vs}>VS</Text>
        <Side name="Maya" score={MAYA_SCORE} animate={animate} delay={duration.base} />
      </View>
      <Rise animate={animate} delay={duration.slow * 5}>
        <View style={styles.chip}>
          <Icon name="hand-left-outline" size={16} color={colors.accent} />
          <Text style={styles.chipText}>Friends can veto a weak proof</Text>
        </View>
      </Rise>
    </View>
  );
}

/** "Beat your friends": a matchup whose scores count up, then the veto that keeps proofs honest. */
export function BeatGraphic({ playing }: { playing: boolean }) {
  const reduceMotion = useReduceMotion();
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (playing && !reduceMotion) setRun((current) => current + 1);
  }, [playing, reduceMotion]);
  return (
    <View style={styles.root}>
      <Scene key={run} animate={playing && !reduceMotion && run > 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: 260, width: "100%", justifyContent: "center" },
  scene: { alignItems: "center", gap: spacing.md },
  card: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "space-around",
    paddingVertical: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  side: { alignItems: "center", gap: spacing.xs, minWidth: 88 },
  name: { ...type.label, color: colors.text },
  score: { fontFamily: fontFamily.extraBold, fontSize: font.total, lineHeight: font.total + 4, color: colors.accent, fontVariant: ["tabular-nums"] },
  vs: { ...type.caption, color: colors.textFaint, letterSpacing: 0.6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
  },
  chipText: { ...type.caption, color: colors.accent },
});
