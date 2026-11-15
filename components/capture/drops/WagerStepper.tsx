import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, spacing } from "@/theme";

import { WAGER_MAX, stepWager } from "./wager";

type Props = { value: number; onChange: (value: number) => void; disabled?: boolean };

export function WagerStepper({ value, onChange, disabled }: Props) {
  return (
    <View style={styles.column}>
      <Text style={styles.label}>WAGER</Text>
      <View style={styles.row}>
        <StepButton symbol="−" label="Lower wager" disabled={disabled || value <= 0} onPress={() => onChange(stepWager(value, -1))} />
        <Text style={styles.value}>{value}</Text>
        <StepButton symbol="+" label="Raise wager" disabled={disabled || value >= WAGER_MAX} onPress={() => onChange(stepWager(value, 1))} />
      </View>
    </View>
  );
}

type StepProps = { symbol: string; label: string; disabled?: boolean; onPress: () => void };

function StepButton({ symbol, label, disabled, onPress }: StepProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={[styles.step, disabled && styles.disabled]}
    >
      <Text style={styles.stepSymbol}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: "center", gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { color: colors.divider, fontSize: font.label, fontWeight: "700", letterSpacing: 0.6 },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  stepSymbol: { color: colors.background, fontSize: font.header, fontWeight: "600", lineHeight: 20 },
  disabled: { opacity: 0.3 },
  value: {
    minWidth: 28,
    textAlign: "center",
    color: colors.background,
    fontSize: font.header,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});
