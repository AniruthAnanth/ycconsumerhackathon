import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { BORDER, colors, font, fontFamily, layout, radius, spacing } from "@/theme";

type Props = TextInputProps & {
  label: string;
  /** Fixed text inside the field before what the player types, such as a country code. */
  prefix?: string;
};

/** A labelled single-line input in a rounded field. */
export function TextField({ label, prefix, style, ...input }: Props) {
  const field = (
    <TextInput
      style={[styles.input, prefix ? styles.afterPrefix : styles.box, style]}
      placeholderTextColor={colors.textFaint}
      accessibilityLabel={label}
      {...input}
    />
  );
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      {prefix ? (
        <View style={[styles.box, styles.row]}>
          <Text style={styles.prefix}>{prefix}</Text>
          {field}
        </View>
      ) : (
        field
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted, letterSpacing: 0.6 },
  box: {
    minHeight: layout.control,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    borderWidth: BORDER,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: { fontFamily: fontFamily.regular, fontSize: font.header, color: colors.text },
  afterPrefix: { flex: 1, minHeight: layout.control },
  prefix: { fontFamily: fontFamily.regular, fontSize: font.header, color: colors.textMuted },
});
