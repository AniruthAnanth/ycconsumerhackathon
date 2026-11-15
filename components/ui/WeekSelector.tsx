import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, hairline, spacing } from "@/theme";

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
};

/** The "< Week 1 >" row under the top tabs. */
export function WeekSelector({ label, onPrev, onNext, onLongPress, arrows = true }: Props) {
  return (
    <View style={styles.bar}>
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
        <Text style={styles.label}>{label}</Text>
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
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    backgroundColor: colors.background,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  label: { minWidth: 72, textAlign: "center", fontSize: font.body, fontFamily: fontFamily.bold, color: colors.text },
});
