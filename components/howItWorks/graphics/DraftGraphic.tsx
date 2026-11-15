import { StyleSheet, Text, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";

import { Icon } from "@/components/ui/Icon";
import { PositionPill } from "@/components/ui/PositionPill";
import { SLOT_NAME, type Slot } from "@/lib/slots";
import { colors, duration, radius, spacing, type } from "@/theme";

import { useBeat } from "./useBeat";

const ROWS: readonly { slot: Slot; task: string }[] = [
  { slot: "body", task: "Leg day at the gym" },
  { slot: "mind", task: "Finish the problem set" },
  { slot: "recharge", task: "Read for 30 minutes" },
  { slot: "chores", task: "Do laundry" },
  { slot: "people", task: "Call Mom Sunday" },
];

const BUBBLE_AT = duration.slow;
const ROWS_AT = duration.slow * 4;

function Ring({ beat }: { beat: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: beat.value * 0.5, transform: [{ scale: 1 + beat.value * 0.7 }] }));
  return <Animated.View style={[styles.ring, style]} />;
}

function DropRow({ playing, index, slot, task }: { playing: boolean; index: number; slot: Slot; task: string }) {
  const beat = useBeat(playing, { delay: ROWS_AT + duration.base * index * 1.5, length: duration.slow });
  const style = useAnimatedStyle(() => ({ opacity: beat.value, transform: [{ translateY: (1 - beat.value) * -24 }] }));
  return (
    <Animated.View style={[styles.row, style]} accessibilityLabel={`${SLOT_NAME[slot]}: ${task}`}>
      <PositionPill slot={slot} />
      <Text style={styles.task} numberOfLines={1}>
        {task}
      </Text>
    </Animated.View>
  );
}

/** "Draft your week": a voice note becomes five lineup rows, one per slot. */
export function DraftGraphic({ playing }: { playing: boolean }) {
  const pulseA = useBeat(playing, { length: duration.slow * 2, pulse: true });
  const pulseB = useBeat(playing, { delay: duration.slow * 2, length: duration.slow * 2, pulse: true });
  const bubbleBeat = useBeat(playing, { delay: BUBBLE_AT, length: duration.slow });
  const bubble = useAnimatedStyle(() => ({ opacity: bubbleBeat.value, transform: [{ translateY: (1 - bubbleBeat.value) * 8 }] }));

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View style={styles.micWrap}>
          <Ring beat={pulseA} />
          <Ring beat={pulseB} />
          <View style={styles.mic}>
            <Icon name="mic" size={22} color={colors.onAccent} />
          </View>
        </View>
        <Animated.View style={[styles.bubble, bubble]}>
          <Text style={styles.bubbleText} numberOfLines={2}>
            Gym Monday, read before bed, call Mom...
          </Text>
        </Animated.View>
      </View>
      <View style={styles.card}>
        {ROWS.map((row, index) => (
          <DropRow key={row.slot} playing={playing} index={index} slot={row.slot} task={row.task} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: 260, width: "100%", justifyContent: "center", gap: spacing.md },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  micWrap: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.accent },
  mic: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  bubble: { flex: 1, backgroundColor: colors.greenSoft, borderRadius: radius.control, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  bubbleText: { ...type.small, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  row: { height: 32, flexDirection: "row", alignItems: "center", gap: spacing.md },
  task: { ...type.small, flex: 1, color: colors.text },
});
