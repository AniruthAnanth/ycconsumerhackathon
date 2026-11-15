import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, Icon } from "@/components/ui";
import { colors, font, hairline, ROW_HEIGHT_COMPACT, spacing } from "@/theme";

type Props = {
  name: string;
  /** A second line under the name, for example a phone number. */
  detail?: string;
  /** When set the row is a checkbox: a tick shows on the right while selected. */
  selected?: boolean;
  onToggle?: () => void;
};

/** One person in a list: avatar, name, optional detail, optional check mark. */
export function PersonRow({ name, detail, selected, onToggle }: Props) {
  const content = (
    <View style={styles.row}>
      <Avatar name={name} size={40} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {onToggle ? (
        <Icon name={selected ? "checkmark-circle" : "ellipse-outline"} size={24} color={selected ? colors.accent : colors.textFaint} />
      ) : null}
    </View>
  );
  if (!onToggle) return content;
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityLabel={`Invite ${name}`}
      accessibilityState={{ checked: !!selected }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT_COMPACT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  text: { flex: 1, gap: 1 },
  name: { fontSize: font.title, fontWeight: "700", color: colors.text },
  detail: { fontSize: font.meta, color: colors.textMuted },
});
