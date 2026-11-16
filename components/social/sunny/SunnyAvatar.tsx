import { StyleSheet, View } from "react-native";

import { Artwork } from "@/components/art";
import { colors } from "@/theme";

/** Where Sunny's head sits in the artwork, as shares of its width and height. */
const HEAD = { x: 0.72, y: 0.42 };
/** How much a cropped face enlarges the artwork, so the head fills the circle. */
const FACE_ZOOM = 2.2;

/**
 * Sunny on the accent tint, round like every player's avatar. `face` crops in on the head, for
 * small sizes like the header, where the whole mascot would read as a green blob.
 */
export function SunnyAvatar({ size, face = false }: { size: number; face?: boolean }) {
  const art = face ? size * FACE_ZOOM : size * 0.86;
  const offset = face ? { position: "absolute" as const, left: size / 2 - art * HEAD.x, top: size / 2 - art * HEAD.y } : null;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Artwork name="sunny" size={art} style={offset} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.accentTint, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
