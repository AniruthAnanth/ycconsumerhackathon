import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import type { Slot } from "@/lib/slots";
import { colors, fontFamily } from "@/theme";

import { Icon } from "./Icon";
import { SLOT_ICON } from "./slotIcons";

type Props = {
  /** A proof photo or a player's picture. */
  uri?: string;
  /** Falls back to this person's initials. */
  name?: string;
  /** Falls back to this slot's icon; wins over `name`. */
  slot?: Slot;
  size?: number;
};

/** The circular thumbnail in a row: a photo when there is one, otherwise a slot icon or initials. */
export function Avatar({ uri, name, slot, size = 40 }: Props) {
  const circle = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[styles.circle, circle]} contentFit="cover" transition={150} />;
  }
  return (
    // Initials only repeat the name beside them, so a screen reader skips them.
    <View style={[styles.circle, circle, slot && { backgroundColor: SLOT_TINT[slot] }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {slot ? (
        <Icon name={SLOT_ICON[slot]} size={size * 0.5} color={colors.text} />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
      )}
    </View>
  );
}

/** The bucket tint behind a slot's icon: care for rest and chores, learn for the mind, play for body and people. */
const SLOT_TINT: Record<Slot, string> = {
  body: colors.play,
  mind: colors.learn,
  recharge: colors.care,
  chores: colors.care,
  people: colors.play,
  flex: colors.greenSoft,
};

function initials(name: string | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]!.toUpperCase()).join("") || "?";
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initials: { fontFamily: fontFamily.bold, color: colors.textMuted },
});
