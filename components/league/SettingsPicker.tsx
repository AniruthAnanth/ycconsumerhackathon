import { Pressable, StyleSheet, Text, View } from "react-native";

import { SectionLabel } from "@/components/ui";
import type { LeagueSettings } from "@/convex/lib/schedule";
import { colors, font, fontFamily, spacing } from "@/theme";

import { FORMAT_CHOICES, PAYOUT_CHOICES, SEASON_WEEKS_CHOICES, type Choice } from "./settings";

type Props = {
  value: LeagueSettings;
  onChange: (settings: LeagueSettings) => void;
};

/** The three things a league's creator decides: when the pot pays out, how long a season is, and who plays whom. */
export function SettingsPicker({ value, onChange }: Props) {
  return (
    <View>
      <SectionLabel left="Payout" />
      <Pills choices={PAYOUT_CHOICES} selected={value.payout} onSelect={(payout) => onChange({ ...value, payout })} />
      <SectionLabel left="Season" />
      <Pills
        choices={SEASON_WEEKS_CHOICES}
        selected={value.seasonWeeks}
        onSelect={(seasonWeeks) => onChange({ ...value, seasonWeeks })}
      />
      <SectionLabel left="Format" />
      <Pills choices={FORMAT_CHOICES} selected={value.format} onSelect={(format) => onChange({ ...value, format })} />
    </View>
  );
}

type PillsProps<Value> = {
  choices: readonly Choice<Value>[];
  selected: Value;
  onSelect: (value: Value) => void;
};

/** One row of pills where exactly one is filled. Pills size to their label, so a long one never truncates. */
function Pills<Value extends string | number>({ choices, selected, onSelect }: PillsProps<Value>) {
  return (
    <View style={styles.pills} accessibilityRole="radiogroup">
      {choices.map((choice) => {
        const isSelected = choice.value === selected;
        return (
          <Pressable
            key={choice.value}
            style={[styles.pill, isSelected && styles.pillSelected]}
            onPress={() => onSelect(choice.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={choice.label}
          >
            <Text style={[styles.label, isSelected && styles.labelSelected]}>{choice.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  // The same outline as OutlinedPillButton, so an unselected pill reads as tappable.
  pill: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.background,
  },
  pillSelected: { backgroundColor: colors.accent },
  label: { fontSize: font.body, fontFamily: fontFamily.bold, color: colors.accent },
  labelSelected: { color: colors.onAccent },
});
