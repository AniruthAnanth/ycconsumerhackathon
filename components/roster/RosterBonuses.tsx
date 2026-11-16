import { StyleSheet, Text, View } from "react-native";

import { Score } from "@/components/ui";
import { colors, layout, SCREEN_MARGIN, type } from "@/theme";

type Props = {
  /** Points the week earned beyond its rows; nothing renders at zero. */
  bonusPoints?: number;
  bonusLabels?: readonly string[];
};

/**
 * The week's bonuses, the points no task row carries. The hero already shows the week's total,
 * so this names only what the bonuses were and what they added.
 */
export function RosterBonuses({ bonusPoints = 0, bonusLabels = [] }: Props) {
  if (bonusPoints <= 0) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.names} numberOfLines={1}>
        Bonuses · {bonusLabels.join(", ")}
      </Text>
      <Score value={bonusPoints} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.rowMin,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
  },
  names: { ...type.small, flex: 1, color: colors.textMuted },
});
