import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, spacing } from "@/theme";

type Props = {
  /** What to say when there is nothing to show: nothing here yet, or what went wrong. */
  message?: string;
  /** Shows the one loading treatment, a muted spinner, in place of the message. */
  loading?: boolean;
  /** Sits inside a list or section instead of filling the screen. */
  inline?: boolean;
};

/**
 * The one empty and loading state: a muted spinner while a query loads, otherwise
 * one muted centred line. Full-screen by default; `inline` for an empty list.
 */
export function EmptyState({ message, loading, inline }: Props) {
  return (
    <View style={inline ? styles.inline : styles.screen}>
      {loading ? <ActivityIndicator color={colors.textMuted} /> : <Text style={styles.text}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, backgroundColor: colors.background },
  inline: { alignItems: "center", padding: spacing.xl },
  text: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.body, textAlign: "center" },
});
