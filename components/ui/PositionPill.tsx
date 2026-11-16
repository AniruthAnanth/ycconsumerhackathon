import { StyleSheet, Text, View } from "react-native";

import { SLOT_LABEL, type Slot } from "@/lib/slots";
import { colors, font, fontFamily, layout, radius } from "@/theme";

/** The green slot pill at the start of a row: Body, Mind, Recharge, Chores, People, Flex. */
export function PositionPill({ slot }: { slot: Slot }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.label}>{SLOT_LABEL[slot]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: layout.pillColumn,
    height: layout.pillHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.accent },
});
