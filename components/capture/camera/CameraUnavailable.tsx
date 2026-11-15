import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui";
import { colors, font, spacing } from "@/theme";

/** Stands in for a preview that would not start, so the screen is never a dead black frame. */
export function CameraUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.text}>Camera unavailable</Text>
      <Button label="Try again" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: "stretch", justifyContent: "center", gap: spacing.lg, paddingHorizontal: spacing.xl },
  text: { color: colors.background, fontSize: font.header, fontWeight: "700", textAlign: "center" },
});
