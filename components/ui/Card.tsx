import { StyleSheet, View, type ViewProps } from "react-native";

import { BORDER, colors, radius } from "@/theme";

/**
 * The one card look, app-wide: white surface, the 1-pt cardBorder outline and the card radius.
 * No shadow: the app is flat, so the outline alone lifts a card off the paper canvas.
 * Spread it into a style for an animated or pressable container that cannot be a Card.
 */
export const cardStyle = {
  backgroundColor: colors.surface,
  borderWidth: BORDER,
  borderColor: colors.cardBorder,
  borderRadius: radius.card,
} as const;

export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({ card: cardStyle });
