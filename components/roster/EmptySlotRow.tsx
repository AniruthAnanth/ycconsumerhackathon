import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, PositionPill, Score, SLOT_NAME, type Slot } from "@/components/ui";
import { colors, font, fontFamily, hairline, ROW_HEIGHT, spacing } from "@/theme";

/**
 * A starter slot with nothing drafted in it. Same height and columns as a
 * TaskRow, so the roster keeps its shape. Without onPress it is a plain row:
 * a week that has ended can no longer be drafted.
 */
export function EmptySlotRow({ slot, onPress }: { slot: Slot; onPress?: () => void }) {
  const columns = (
    <>
      <PositionPill slot={slot} />
      <Avatar slot={slot} />
      <Text style={styles.empty}>Empty</Text>
      <Score value={null} />
    </>
  );
  if (!onPress) return <View style={styles.row}>{columns}</View>;
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Empty ${SLOT_NAME[slot]} slot, draft a task`}>
      {columns}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  empty: { flex: 1, fontFamily: fontFamily.regular, fontSize: font.title, color: colors.textFaint },
});
