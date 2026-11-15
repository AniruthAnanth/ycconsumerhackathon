import { StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, spacing } from "@/theme";
import type { Coordinate } from "./PlaceMap.types";

/** react-native-maps cannot bundle for web, so the browser shows where the pin is as text. */
export function PlaceMap({ coordinate, title }: { coordinate: Coordinate; title?: string; onPick?: (coordinate: Coordinate) => void }) {
  return (
    <View style={styles.box}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.coordinates}>
        {coordinate.lat.toFixed(4)}, {coordinate.lng.toFixed(4)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 220, width: "100%", alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.lg, backgroundColor: colors.strip },
  title: { fontSize: font.header, fontFamily: fontFamily.bold, color: colors.text, textAlign: "center" },
  coordinates: { fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted },
});
