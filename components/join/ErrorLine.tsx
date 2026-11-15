import { StyleSheet, Text } from "react-native";

import { colors, font, fontFamily } from "@/theme";

/** A one-line failure under the control that caused it. */
export function ErrorLine({ message }: { message: string }) {
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.danger },
});
