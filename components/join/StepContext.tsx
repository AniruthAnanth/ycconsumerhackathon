import { StyleSheet, Text, View } from "react-native";

import { colors, layout, spacing, type } from "@/theme";

/** "Step 2 of 3 · Join or start a league": where a new player is on the way into their first league. */
export function StepContext({ step, of = 3, label }: { step: number; of?: number; label: string }) {
  return (
    <View style={styles.bar}>
      <Text style={styles.text}>
        Step {step} of {of} · {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: layout.margin, paddingTop: spacing.md },
  text: { ...type.label, color: colors.textMuted },
});
