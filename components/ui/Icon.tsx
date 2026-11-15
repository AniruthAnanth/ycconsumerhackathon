import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

import { colors } from "@/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = { name: IconName; size?: number; color?: string };

/**
 * The app's single icon set, so screens never import a vector-icon family directly.
 *
 * Icons are decoration: the button or row they sit in carries the label. They are
 * hidden from screen readers, which would otherwise read the glyph's character.
 */
export function Icon({ name, size = 20, color = colors.text }: Props) {
  return <Ionicons name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no" />;
}
