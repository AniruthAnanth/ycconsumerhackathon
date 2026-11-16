import { StyleSheet, Text, View } from "react-native";

import { PressScale } from "@/components/motion";
import { cardStyle, Icon } from "@/components/ui";
import { colors, layout, spacing, type } from "@/theme";

type Props = {
  label: string;
  /** One line saying what picking this means. */
  explanation: string;
  example?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** For a label that means little out of context, such as "$5". Defaults to the label. */
  accessibilityLabel?: string;
};

/** One answer on a step of the walkthrough: its name, what it means, and an example where one helps. */
export function ChoiceCard({ label, explanation, example, selected, onPress, disabled = false, accessibilityLabel = label }: Props) {
  return (
    <PressScale
      style={[styles.card, selected && styles.selected]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={explanation}
      accessibilityState={{ checked: selected, disabled }}
    >
      <Icon name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={selected ? colors.accent : colors.textFaint} />
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.explanation}>{explanation}</Text>
        {example ? <Text style={styles.example}>Example: {example}</Text> : null}
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardStyle,
    flexDirection: "row",
    gap: layout.columnGap,
    minHeight: layout.rowMin,
    padding: spacing.lg,
  },
  selected: { borderColor: colors.accent, backgroundColor: colors.accentTint },
  text: { flex: 1, gap: spacing.xs },
  label: { ...type.label, color: colors.text },
  explanation: { ...type.small, color: colors.textMuted },
  example: { ...type.small, color: colors.textFaint },
});
