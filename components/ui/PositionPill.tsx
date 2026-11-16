import { StyleSheet, Text, View } from "react-native";

import { SLOT_LABEL, type Slot } from "@/lib/slots";
import { font, fontFamily, layout, radius, slotTint } from "@/theme";

/** The slot pill at the start of a row, in its slot's own tint: Body, Mind, Recharge, Chores, People, Flex. */
export function PositionPill({ slot }: { slot: Slot }) {
  return (
    <View style={[styles.pill, { backgroundColor: slotTint[slot].bg }]}>
      <Text style={[styles.label, { color: slotTint[slot].fg }]}>{SLOT_LABEL[slot]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: layout.pillColumn,
    height: layout.pillHeight,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: font.label, fontFamily: fontFamily.bold },
});
