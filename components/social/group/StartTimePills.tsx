import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, spacing } from "@/theme";
import { formatStart, type StartOption } from "./groupLogic";

/** The quick start times as a row of pills, with the chosen one filled and its resolved time below. */
export function StartTimePills({
  options,
  selected,
  onSelect,
}: {
  options: StartOption[];
  selected: StartOption | undefined;
  onSelect: (option: StartOption) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>START TIME</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const active = option === selected;
          return (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(option)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {selected ? <Text style={styles.resolved}>{formatStart(selected.startsAt)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, padding: spacing.lg },
  label: { fontSize: font.label, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pill: {
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: { backgroundColor: colors.accent },
  pillText: { fontSize: font.body, fontWeight: "700", color: colors.accent },
  pillTextActive: { color: colors.background },
  resolved: { fontSize: font.title, fontWeight: "700", color: colors.text },
});
