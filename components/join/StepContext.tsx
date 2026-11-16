import { StyleSheet, Text, View } from "react-native";

import { colors, layout, spacing, type } from "@/theme";

/**
 * "Step 2 of 3": where a new player is on the way into their first league. Only the count: the
 * screen's own large title already says what the step is about.
 */
export function StepContext({ step, of = 3 }: { step: number; of?: number }) {
  return (
    <View style={styles.bar}>
      <Text style={styles.text}>
        Step {step} of {of}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: layout.margin, paddingTop: spacing.md },
  text: { ...type.small, color: colors.textMuted },
});
