import { StyleSheet, View } from "react-native";

import { Artwork } from "@/components/art";
import { colors } from "@/theme";

/** Sunny's face: the capybara mascot on the accent tint, round like every player's avatar. */
export function SunnyAvatar({ size }: { size: number }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Artwork name="sunny" size={size * 0.86} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.accentTint, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
