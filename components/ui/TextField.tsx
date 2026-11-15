import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { colors, font, hairline, spacing } from "@/theme";

type Props = TextInputProps & { label: string };

/** A labelled single-line input with a hairline under it, to match the rows around it. */
export function TextField({ label, style, ...input }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput style={[styles.input, style]} placeholderTextColor={colors.textFaint} accessibilityLabel={label} {...input} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs, borderBottomWidth: hairline, borderBottomColor: colors.divider },
  label: { fontSize: font.label, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.6 },
  input: { height: 44, fontSize: font.header, color: colors.text, padding: 0 },
});
