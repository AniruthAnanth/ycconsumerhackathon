import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, hairline, spacing } from "@/theme";

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
};

/** The "< Week 1 >" row under the top tabs. */
export function WeekSelector({ label, onPrev, onNext, onLongPress }: Props) {
  return (
    <View style={styles.bar}>
      <Pressable onPress={onPrev} disabled={!onPrev} hitSlop={12} accessibilityRole="button" accessibilityLabel="Previous week">
        <Icon name="chevron-back" size={18} color={onPrev ? colors.text : colors.textFaint} />
      </Pressable>
      <Pressable onLongPress={onLongPress} delayLongPress={600} disabled={!onLongPress} accessibilityLabel={label}>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      <Pressable onPress={onNext} disabled={!onNext} hitSlop={12} accessibilityRole="button" accessibilityLabel="Next week">
        <Icon name="chevron-forward" size={18} color={onNext ? colors.text : colors.textFaint} />
      </Pressable>
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
  label: { minWidth: 72, textAlign: "center", fontSize: font.body, fontWeight: "700", color: colors.text },
});
