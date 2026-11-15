import { StyleSheet, Text } from "react-native";

import { colors, type } from "@/theme";

/** A one-line failure under the control that caused it. */
export function ErrorLine({ message }: { message: string }) {
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: { ...type.small, color: colors.danger },
});
