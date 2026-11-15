import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, font, hairline, spacing, tabUnderlineHeight } from "@/theme";

import { BOARDS } from "./boards";
import type { BoardKey } from "./types";

type Props = {
  active: BoardKey;
  onChange: (key: BoardKey) => void;
};

/** TopTabs, but scrollable: fourteen boards do not fit across a phone. */
export function BoardPicker({ active, onChange }: Props) {
  return (
    <View style={styles.bar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist">
        {BOARDS.map((board) => {
          const selected = board.key === active;
          return (
            <Pressable
              key={board.key}
              style={styles.tab}
              onPress={() => onChange(board.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={board.label}
            >
              <Text style={[styles.label, selected && styles.labelActive]}>{board.label.toUpperCase()}</Text>
              <View style={[styles.underline, selected && styles.underlineActive]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 40,
    backgroundColor: colors.background,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  tab: { height: 40, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  label: { fontSize: font.meta, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 },
  labelActive: { color: colors.text },
  underline: { position: "absolute", left: 0, right: 0, bottom: 0, height: tabUnderlineHeight, backgroundColor: "transparent" },
  underlineActive: { backgroundColor: colors.tabActive },
});
