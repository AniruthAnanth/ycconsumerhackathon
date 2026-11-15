import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, layout, radius, spacing } from "@/theme";

type Props = { beforeUri: string | null };

/** Before/after: the before shot sits faintly over the preview so the after can be lined up with it. */
export function GhostOverlay({ beforeUri }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {beforeUri ? <Image source={{ uri: beforeUri }} style={[StyleSheet.absoluteFill, styles.ghost]} contentFit="cover" testID="camera-ghost" /> : null}
      <View style={styles.stepRow}>
        <Text style={styles.step} testID="camera-step">
          {beforeUri ? "2 OF 2 · AFTER: LINE IT UP WITH THE GHOST" : "1 OF 2 · BEFORE"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ghost: { opacity: 0.35 },
  stepRow: { position: "absolute", left: 0, right: 0, bottom: 220, alignItems: "center" },
  step: {
    color: colors.onAccent,
    fontFamily: fontFamily.bold,
    fontSize: font.label,
    letterSpacing: 1,
    lineHeight: layout.pillHeight,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
});
