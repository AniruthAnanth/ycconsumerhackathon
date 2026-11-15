import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import type { DevFlags } from "@/lib/devFlags";
import { RowDivider } from "@/components/ui";
import { colors, font, fontFamily, hairline, layout, radius, SCREEN_MARGIN, spacing } from "@/theme";

/** A development flag with its switch. */
export function FlagRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent }} />
      <RowDivider inset={SCREEN_MARGIN} />
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
      <RowDivider inset={SCREEN_MARGIN} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.rowMin,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.sm,
  },
  label: { flex: 1, color: colors.text, fontSize: font.title, fontFamily: fontFamily.bold },
  spot: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderWidth: hairline,
    borderColor: colors.accent,
    borderRadius: radius.pill,
  },
  spotSelected: { backgroundColor: colors.accent },
  spotLabel: { color: colors.accent, fontSize: font.body, fontFamily: fontFamily.bold },
  spotLabelSelected: { color: colors.onAccent },
});
