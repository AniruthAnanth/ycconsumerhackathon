import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, colors } from "../kit";

/** One attendee: avatar, name and whether they have checked in at the place. */
export function AttendeeRow({ name, checkedIn, onPress }: { name: string; checkedIn: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <Avatar name={name} size={40} />
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
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "600" },
  status: { fontSize: 13, fontWeight: "600" },
  checkedIn: { color: colors.green },
  going: { color: colors.muted },
});
