import { StyleSheet, Text, View } from "react-native";

import { SLOT_LABEL, type Slot } from "@/lib/slots";
import { colors, font, fontFamily } from "@/theme";

/** The blue outlined position code at the start of a row: BOD, MND, RCH, CHR, PPL, FLX. */
export function PositionPill({ slot }: { slot: Slot }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.label}>{SLOT_LABEL[slot]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 40,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.accent, letterSpacing: 0.3 },
});
