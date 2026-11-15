import { Pressable, StyleSheet, Text, View } from "react-native";

import { BORDER, colors, MIN_TARGET, radius, spacing, type } from "@/theme";

import { STAKES, type Stake } from "./stakes";

type Props = { value: Stake; onChange: (stakeUsd: Stake) => void; disabled?: boolean };

/**
 * Pick one stake. OutlinedPillButton has no selected state, so the chosen pill
 * fills with the accent while the others stay outlined.
 */
export function StakePicker({ value, onChange, disabled = false }: Props) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {STAKES.map(({ stakeUsd, label }) => {
        const selected = stakeUsd === value;
        return (
          <Pressable
            key={stakeUsd}
            style={[styles.pill, selected && styles.selected, disabled && styles.disabled]}
            onPress={() => onChange(stakeUsd)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={`Stake ${label}`}
            accessibilityState={{ checked: selected, disabled }}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  pill: {
    flex: 1,
    minHeight: MIN_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.control,
    borderWidth: BORDER,
    borderColor: colors.accent,
    backgroundColor: colors.background,
  },
  selected: { backgroundColor: colors.accent },
  disabled: { opacity: 0.4 },
  label: { ...type.label, color: colors.accent },
  selectedLabel: { color: colors.onAccent },
});
