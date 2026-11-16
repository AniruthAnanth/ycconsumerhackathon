import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { useReduceMotion } from "@/components/motion";
import { Icon } from "@/components/ui";
import { haptics } from "@/lib/native/haptics";
import { FADE_MS, STAMP_DROP_MS, STAMP_SETTLE_MS } from "@/lib/native/motion";
import { SLOT_NAME } from "@/lib/slots";
import { colors, font, fontFamily, hairline, layout, radius, slotTint, spacing, type } from "@/theme";

import { CORE_SLOTS, type CoreSlot } from "./bucketMatch";

/** The five buckets under the live words: each fills with its tint once the player has named something for it. */
export function BucketChips({ lit }: { lit: Set<CoreSlot> }) {
  const complete = lit.size === CORE_SLOTS.length;
  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>Mention at least one thing for each</Text>
      <View style={styles.row}>
        {CORE_SLOTS.map((slot) => (
          <Chip key={slot} slot={slot} lit={lit.has(slot)} />
        ))}
      </View>
      {complete ? <Covered /> : null}
    </View>
  );
}

function Chip({ slot, lit }: { slot: CoreSlot; lit: boolean }) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const wasLit = useRef(lit);

  useEffect(() => {
    if (lit === wasLit.current) return;
    wasLit.current = lit;
    if (!lit) return;
    haptics.select();
    if (!reduceMotion) scale.value = withSequence(withTiming(1.12, { duration: STAMP_SETTLE_MS }), withTiming(1, { duration: STAMP_DROP_MS }));
  }, [lit, reduceMotion, scale]);

  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const tint = slotTint[slot];
  return (
    <Animated.View
      style={[styles.chip, lit ? { backgroundColor: tint.bg, borderColor: tint.bg } : null, pop]}
      accessible
      accessibilityLabel={`${SLOT_NAME[slot]}, ${lit ? "covered" : "not yet"}`}
    >
      {lit ? <Icon name="checkmark" size={14} color={tint.fg} /> : null}
      <Text style={[styles.label, { color: lit ? tint.fg : colors.textMuted }]}>{SLOT_NAME[slot]}</Text>
    </Animated.View>
  );
}

/** A small pulse the moment the fifth bucket lights, then it stays put. */
function Covered() {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withTiming(1, { duration: FADE_MS });
    scale.value = withSequence(withTiming(1.08, { duration: FADE_MS }), withTiming(1, { duration: FADE_MS }));
  }, [reduceMotion, opacity, scale]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return (
    <Animated.Text style={[styles.covered, pulse]} accessibilityLiveRegion="polite">
      All 5 covered
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  hint: { ...type.small, color: colors.textMuted },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: layout.pillHeight,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: hairline,
    borderColor: colors.divider,
  },
  label: { fontSize: font.label, fontFamily: fontFamily.bold },
  covered: { ...type.caption, fontFamily: fontFamily.bold, letterSpacing: 0.6, color: colors.accent, alignSelf: "flex-start" },
});
