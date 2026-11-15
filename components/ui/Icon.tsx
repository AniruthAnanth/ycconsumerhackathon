import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { View } from "react-native";

import { SF_SYMBOL_FOR_IONICON } from "@/lib/native/sfSymbols";
import { SymbolIcon } from "@/lib/native/SymbolIcon";
import { colors } from "@/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = { name: IconName; size?: number; color?: string };

/**
 * The app's single icon set, so screens never import a vector-icon family directly.
 *
 * Icons are decoration: the button or row they sit in carries the label. They are
 * hidden from screen readers, which would otherwise read the glyph's character.
 *
 * Names are Ionicons. On iOS a mapped name draws its SF Symbol instead (SymbolIcon keeps the Ionicon
 * off iOS), and an unmapped name stays an Ionicon everywhere, so nothing disappears.
 */
export function Icon({ name, size = 20, color = colors.text }: Props) {
  const symbol = SF_SYMBOL_FOR_IONICON[name];
  if (!symbol) {
    return <Ionicons name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no" />;
  }
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SymbolIcon ios={symbol} fallback={name} size={size} color={color} />
    </View>
  );
}
