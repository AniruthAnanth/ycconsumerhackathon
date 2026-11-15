import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import type { DevFlags } from "@/lib/devFlags";
import { colors, font, hairline, spacing } from "@/theme";

/** A development flag with its switch. */
export function FlagRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent }} />
    </View>
  );
}

const SPOTS: { value: DevFlags["overrideSpot"]; label: string }[] = [
  { value: "place", label: "At the place" },
  { value: "away", label: "Far away" },
];

/** Picks which fixed point the location override reports: one that passes the check or one that fails it. */
export function OverrideSpotRow({ value, onChange }: { value: DevFlags["overrideSpot"]; onChange: (value: DevFlags["overrideSpot"]) => void }) {
  return (
    <View style={styles.row}>
      {SPOTS.map((spot) => {
        const selected = spot.value === value;
        return (
          <Pressable
            key={spot.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(spot.value)}
            style={[styles.spot, selected && styles.spotSelected]}
          >
            <Text style={[styles.spotLabel, selected && styles.spotLabelSelected]}>{spot.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  label: { flex: 1, color: colors.text, fontSize: font.title, fontWeight: "700" },
  spot: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
  },
  spotSelected: { backgroundColor: colors.accent },
  spotLabel: { color: colors.accent, fontSize: font.body, fontWeight: "700" },
  spotLabelSelected: { color: colors.background },
});
