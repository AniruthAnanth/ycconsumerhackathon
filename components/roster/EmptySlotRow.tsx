import { Pressable, StyleSheet, Text, View } from "react-native";

import { PositionPill, RowDivider, Score, SLOT_NAME, type Slot } from "@/components/ui";
import { colors, font, fontFamily, layout, ROW_HEIGHT, SCREEN_MARGIN, TASK_TEXT_INSET } from "@/theme";

/**
 * A starter slot with nothing drafted in it. Same height and columns as a
 * TaskRow, so the roster keeps its shape. Without onPress it is a plain row:
 * a week that has ended can no longer be drafted.
 */
export function EmptySlotRow({ slot, onPress }: { slot: Slot; onPress?: () => void }) {
  const columns = (
    <>
      <PositionPill slot={slot} />
      <Text style={styles.empty}>Empty</Text>
      <Score value={null} />
      <RowDivider inset={TASK_TEXT_INSET} />
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
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
  },
  empty: { flex: 1, fontFamily: fontFamily.regular, fontSize: font.title, color: colors.textFaint },
});
