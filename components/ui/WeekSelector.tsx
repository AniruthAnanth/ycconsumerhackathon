import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, hairline, layout, radius, spacing } from "@/theme";

import { Icon } from "./Icon";

type Props = {
  /** For example "Week 1". */
  label: string;
  /** Omit at the first week; the chevron greys out. */
  onPrev?: () => void;
  /** Omit at the last week; the chevron greys out. */
  onNext?: () => void;
  /** The hidden door to demo controls. */
  onLongPress?: () => void;
  /** False hides both chevrons, for a tab that cannot show another week. Defaults to true. */
  arrows?: boolean;
  /** A small pill for the header row instead of its own bar under it. */
  compact?: boolean;
};

/** The "< Week 1 >" row under the top tabs. */
export function WeekSelector({ label, onPrev, onNext, onLongPress, arrows = true, compact = false }: Props) {
  return (
    <View style={compact ? styles.pill : styles.bar}>
      {arrows && (
        <Pressable onPress={onPrev} disabled={!onPrev} hitSlop={12} accessibilityRole="button" accessibilityLabel="Previous week">
          <Icon name="chevron-back" size={18} color={onPrev ? colors.text : colors.textFaint} />
        </Pressable>
      )}
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={600}
        disabled={!onLongPress}
        // Nothing on screen shows the door, so the hint is how a screen reader user finds it.
        accessibilityRole={onLongPress ? "button" : "text"}
        accessibilityLabel={label}
        accessibilityHint={onLongPress ? "Hold for demo controls" : undefined}
      >
        <Text style={compact ? styles.pillLabel : styles.label}>{label}</Text>
      </Pressable>
      {arrows && (
        <Pressable onPress={onNext} disabled={!onNext} hitSlop={12} accessibilityRole="button" accessibilityLabel="Next week">
          <Icon name="chevron-forward" size={18} color={onNext ? colors.text : colors.textFaint} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: layout.bar,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    backgroundColor: colors.background,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  // In the header row: a soft pill whose chevrons keep 44-pt targets through their slop.
  pill: {
    height: layout.pillHeight + spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
  },
  pillLabel: { fontSize: font.meta, fontFamily: fontFamily.bold, color: colors.text },
  label: { minWidth: 72, textAlign: "center", fontSize: font.body, fontFamily: fontFamily.bold, color: colors.text },
});
