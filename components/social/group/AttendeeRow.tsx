import { Pressable, StyleSheet, Text } from "react-native";

import { Avatar, RowDivider } from "@/components/ui";
import { colors, font, fontFamily, layout, PERSON_TEXT_INSET, ROW_HEIGHT_COMPACT, SCREEN_MARGIN } from "@/theme";

/** One attendee: avatar, name and whether they have checked in at the place. */
export function AttendeeRow({ name, checkedIn, onPress }: { name: string; checkedIn: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <Avatar name={name} size={layout.avatarCompact} />
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.status, checkedIn ? styles.checkedIn : styles.going]}>
        {checkedIn ? "Checked in" : "Going"}
      </Text>
      <RowDivider inset={PERSON_TEXT_INSET} />
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
  name: { flex: 1, color: colors.text, fontSize: font.title, fontFamily: fontFamily.bold },
  status: { fontSize: font.body, fontFamily: fontFamily.bold },
  checkedIn: { color: colors.tabActive },
  going: { color: colors.textMuted },
});
