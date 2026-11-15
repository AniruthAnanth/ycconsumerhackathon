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
    <View style={[styles.circle, circle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {slot ? (
        <Icon name={SLOT_ICON[slot]} size={size * 0.5} color={colors.textMuted} />
      ) : (
        <Text style={[styles.initials, { fontFamily: fontFamily.regular, fontSize: size * 0.38 }]}>{initials(name)}</Text>
      )}
    </View>
  );
}

function initials(name: string | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]!.toUpperCase()).join("") || "?";
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.strip, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initials: { fontFamily: fontFamily.bold, color: colors.textMuted },
});
