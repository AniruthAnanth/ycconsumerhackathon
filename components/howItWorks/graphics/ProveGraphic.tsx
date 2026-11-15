import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { Artwork } from "@/components/art";
import { StampSlam, useReduceMotion } from "@/components/motion";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PROOF_LABEL, type ProofType } from "@/lib/slots";
import { colors, duration, radius, spacing, type } from "@/theme";

import { useBeat } from "./useBeat";

const CHIPS: readonly { proof: ProofType; icon: IconName }[] = [
  { proof: "photo", icon: "camera-outline" },
  { proof: "before_after", icon: "swap-horizontal-outline" },
  { proof: "timelapse", icon: "timer-outline" },
  { proof: "screenshot", icon: "phone-portrait-outline" },
];

const FLASH_AT = duration.slow * 2;
const STAMP_AT = FLASH_AT + duration.slow;
const CHIPS_AT = STAMP_AT + duration.slow * 2;
const FRAME = 132;

function Chip({ playing, index, proof, icon }: { playing: boolean; index: number; proof: ProofType; icon: IconName }) {
  const beat = useBeat(playing, { delay: CHIPS_AT + duration.base * index, length: duration.slow });
  const style = useAnimatedStyle(() => ({ opacity: beat.value, transform: [{ translateY: (1 - beat.value) * 12 }] }));
  const label = proof === "before_after" ? "Before/after" : PROOF_LABEL[proof];
  return (
    <Animated.View style={[styles.chip, style]}>
      <View style={styles.chipIcon}>
        <Icon name={icon} size={22} color={colors.accent} />
      </View>
      <Text style={styles.chipLabel} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

/** "Prove it": a photo inside a viewfinder, a flash, then the referee's Verified stamp. */
export function ProveGraphic({ playing }: { playing: boolean }) {
  const reduceMotion = useReduceMotion();
  const flashBeat = useBeat(playing, { delay: FLASH_AT, length: duration.fast, pulse: true });
  const flash = useAnimatedStyle(() => ({ opacity: flashBeat.value }));

  const runs = useRef(0);
  const wasPlaying = useRef(false);
  if (playing && !wasPlaying.current) runs.current += 1;
  wasPlaying.current = playing;

  const stamp = (
    <View style={styles.stamp}>
      <Icon name="checkmark-circle" size={16} color={colors.accent} />
      <Text style={styles.stampText}>Verified +40</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.frame}>
        <Artwork name="exercise" size={88} />
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
        <Animated.View pointerEvents="none" style={[styles.flash, flash]} />
        <View style={styles.stampSlot}>
          {playing && !reduceMotion ? (
            <StampSlam key={runs.current} delay={STAMP_AT}>
              {stamp}
            </StampSlam>
          ) : (
            stamp
          )}
        </View>
      </View>
      <View style={styles.chips}>
        {CHIPS.map((chip, index) => (
          <Chip key={chip.proof} playing={playing} index={index} proof={chip.proof} icon={chip.icon} />
        ))}
      </View>
    </View>
  );
}

const BRACKET = 22;
const bracket = { position: "absolute", width: BRACKET, height: BRACKET, borderColor: colors.accent } as const;

const styles = StyleSheet.create({
  root: { height: 260, width: "100%", alignItems: "center", justifyContent: "center", gap: spacing.xl },
  frame: { width: FRAME * 1.5, height: FRAME, alignItems: "center", justifyContent: "center", borderRadius: radius.md, overflow: "visible" },
  corner: bracket,
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: radius.md },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: radius.md },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: radius.md },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: radius.md },
  flash: { ...StyleSheet.absoluteFill as object, backgroundColor: colors.white, borderRadius: radius.md },
  stampSlot: { position: "absolute", bottom: -spacing.md, right: -spacing.sm, transform: [{ rotate: "-8deg" }] },
  stamp: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.lime,
    borderColor: colors.accent,
    borderWidth: 2,
    borderRadius: radius.control,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  stampText: { ...type.label, color: colors.accent },
  chips: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: spacing.sm },
  chip: { flex: 1, alignItems: "center", gap: spacing.xs },
  chipIcon: { width: 48, height: 48, borderRadius: radius.control, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  chipLabel: { ...type.caption, color: colors.textMuted },
});
