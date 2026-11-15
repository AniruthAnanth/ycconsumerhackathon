import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../kit";
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
      <Text style={styles.label}>Start time</Text>
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
  wrap: { paddingHorizontal: 16, paddingVertical: 10 },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: { backgroundColor: colors.accent },
  pillText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  pillTextActive: { color: colors.bg },
  resolved: { color: colors.text, fontSize: 15, fontWeight: "700", marginTop: 10 },
});
