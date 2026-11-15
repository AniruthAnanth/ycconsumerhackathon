import { Pressable, StyleSheet, Text } from "react-native";

import { Avatar } from "@/components/ui";
import { colors, font, fontFamily, hairline, ROW_HEIGHT, spacing } from "@/theme";

/** One attendee: avatar, name and whether they have checked in at the place. */
export function AttendeeRow({ name, checkedIn, onPress }: { name: string; checkedIn: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <Avatar name={name} />
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.status, checkedIn ? styles.checkedIn : styles.going]}>
        {checkedIn ? "Checked in" : "Going"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  name: { flex: 1, color: colors.text, fontSize: font.title, fontFamily: fontFamily.bold },
  status: { fontSize: font.body, fontFamily: fontFamily.bold },
  checkedIn: { color: colors.tabActive },
  going: { color: colors.textMuted },
});
