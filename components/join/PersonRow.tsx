import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, Icon, type IconName } from "@/components/ui";
import { colors, hairline, layout, PERSON_TEXT_INSET, radius, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, type } from "@/theme";

type Props = {
  name: string;
  /** A second line under the name, for example a phone number. */
  detail?: string;
  /** When set the row is a checkbox: a tick shows on the right while selected. */
  selected?: boolean;
  onToggle?: () => void;
  /** Shown instead of initials when the row is an action rather than a person, such as sending a link. */
  icon?: IconName;
};

/** One person in a list: avatar, name, optional detail, optional check mark. */
export function PersonRow({ name, detail, selected, onToggle, icon }: Props) {
  const content = (
    <View style={styles.row}>
      {icon ? (
        <View style={styles.iconBadge}>
          <Icon name={icon} color={colors.accent} />
        </View>
      ) : (
        <Avatar name={name} size={layout.avatarCompact} />
      )}
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
      {/* From the text edge to the right margin, like the rest of the grid. */}
      <View style={styles.divider} pointerEvents="none" />
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
    minHeight: ROW_HEIGHT_COMPACT,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
  },
  text: { flex: 1 },
  iconBadge: {
    width: layout.avatarCompact,
    height: layout.avatarCompact,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTint,
  },
  divider: { position: "absolute", left: PERSON_TEXT_INSET, right: SCREEN_MARGIN, bottom: 0, height: hairline, backgroundColor: colors.divider },
  name: { ...type.subheading, color: colors.text },
  detail: { ...type.small, color: colors.textMuted },
});
