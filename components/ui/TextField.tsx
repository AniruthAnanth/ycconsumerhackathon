import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { colors, font, fontFamily, radius, spacing } from "@/theme";

type Props = TextInputProps & { label: string };

/** A labelled single-line input in a rounded field. */
export function TextField({ label, style, ...input }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput style={[styles.input, style]} placeholderTextColor={colors.textFaint} accessibilityLabel={label} {...input} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted, letterSpacing: 0.6 },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    fontFamily: fontFamily.regular,
    fontSize: font.header,
    color: colors.text,
  },
});
