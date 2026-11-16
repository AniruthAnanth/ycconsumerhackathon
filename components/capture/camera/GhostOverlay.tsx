import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, layout, radius, spacing } from "@/theme";

type Props = { beforeUri: string | null };

/** Before/after: the before shot sits faintly over the preview so the after can be lined up with it. */
export function GhostOverlay({ beforeUri }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {beforeUri ? <Image source={{ uri: beforeUri }} style={[StyleSheet.absoluteFill, styles.ghost]} contentFit="cover" testID="camera-ghost" /> : null}
    </View>
  );
}

/** Which shot is next. It sits in the bottom stack above the shutter, so it never collides with the bar on a short screen. */
export function GhostStep({ beforeUri }: Props) {
  return (
    <Text style={styles.step} testID="camera-step">
      {beforeUri ? "2 OF 2 · AFTER: LINE IT UP WITH THE GHOST" : "1 OF 2 · BEFORE"}
    </Text>
  );
}

const styles = StyleSheet.create({
  ghost: { opacity: 0.35 },
  step: {
    alignSelf: "center",
    marginBottom: spacing.md,
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
