import { StyleSheet, Text } from "react-native";

import { colors, font } from "@/theme";

/** A one-line failure under the control that caused it. */
export function ErrorLine({ message }: { message: string }) {
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: font.meta, color: colors.danger },
});
