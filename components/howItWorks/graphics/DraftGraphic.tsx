import { StyleSheet, Text, View } from "react-native";
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from "react-native-reanimated";

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
/** Each row starts this long after the one above it and takes ROW_LENGTH to land. */
const ROW_STAGGER = duration.base * 1.5;
const ROW_LENGTH = duration.slow;
const ROWS_LENGTH = ROW_STAGGER * (ROWS.length - 1) + ROW_LENGTH;

function Ring({ beat }: { beat: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: beat.value * 0.5, transform: [{ scale: 1 + beat.value * 0.7 }] }));
  return <Animated.View style={[styles.ring, style]} />;
}

/**
 * One row's share of the single rows beat. Five separately delayed animations left the rows at 0 on
 * the owner's iPhone; one beat for all of them runs exactly like the bubble's, which did play.
 */
function DropRow({ rows, index, slot, task }: { rows: SharedValue<number>; index: number; slot: Slot; task: string }) {
  const style = useAnimatedStyle(() => {
    const start = (ROW_STAGGER * index) / ROWS_LENGTH;
    const end = (ROW_STAGGER * index + ROW_LENGTH) / ROWS_LENGTH;
    const landed = interpolate(rows.value, [start, end], [0, 1], Extrapolation.CLAMP);
    return { opacity: landed, transform: [{ translateY: (1 - landed) * -24 }] };
  });
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
  const rows = useBeat(playing, { delay: ROWS_AT, length: ROWS_LENGTH });
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
          <DropRow key={row.slot} rows={rows} index={index} slot={row.slot} task={row.task} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: 260, width: "100%", justifyContent: "center", gap: spacing.md },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  // Above the bubble, so the pulse draws over everything around it.
  micWrap: { width: 48, height: 48, alignItems: "center", justifyContent: "center", zIndex: 1 },
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
