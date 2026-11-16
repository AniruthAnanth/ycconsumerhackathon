import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Divider, Icon } from "@/components/ui";
import { BORDER, colors, font, fontFamily, hairline, MIN_TARGET, radius, SCREEN_MARGIN, spacing } from "@/theme";

import { BOARDS, isPrimaryBoard, MORE_BOARDS, PRIMARY_BOARDS } from "./boards";
import type { BoardKey } from "./types";

type Props = {
  active: BoardKey;
  onChange: (key: BoardKey) => void;
};

/**
 * Week, Season and All-time as a segmented control, and every other board behind one
 * "More boards" row that expands in place: sixteen tabs in a scrolling strip hid most of them.
 */
export function BoardPicker({ active, onChange }: Props) {
  const [open, setOpen] = useState(false);
  // While a secondary board is showing, the More row names it, so the choice is visible once and only there.
  const moreLabel = isPrimaryBoard(active) ? undefined : BOARDS.find((board) => board.key === active)?.label;

  return (
    <View style={styles.bar}>
      <View style={styles.segments} accessibilityRole="tablist">
        {PRIMARY_BOARDS.map((board, index) => {
          const selected = board.key === active;
          return (
            <Pressable
              key={board.key}
              style={[styles.segment, index > 0 && styles.segmentDivider, selected && styles.segmentActive]}
              onPress={() => {
                setOpen(false);
                onChange(board.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={BOARDS.find((entry) => entry.key === board.key)?.label}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{board.segment}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        style={styles.moreRow}
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={moreLabel ? `More boards, showing ${moreLabel}` : "More boards"}
      >
        <Text style={styles.moreText}>More boards</Text>
        {moreLabel ? <Text style={styles.moreValue}>{moreLabel}</Text> : null}
        <Icon name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textFaint} />
      </Pressable>
      {open
        ? MORE_BOARDS.map((board) => {
            const selected = board.key === active;
            return (
              <View key={board.key}>
                <Divider inset={SCREEN_MARGIN} />
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    setOpen(false);
                    onChange(board.key);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={board.label}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextActive]}>{board.label}</Text>
                  {selected ? <Icon name="checkmark" size={18} color={colors.accent} /> : null}
                </Pressable>
              </View>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  segments: {
    height: MIN_TARGET,
    marginHorizontal: SCREEN_MARGIN,
    flexDirection: "row",
    borderWidth: BORDER,
    borderColor: colors.divider,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  segment: { flex: 1, alignItems: "center", justifyContent: "center" },
  segmentDivider: { borderLeftWidth: BORDER, borderLeftColor: colors.divider },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: font.body, fontFamily: fontFamily.bold, color: colors.textMuted },
  segmentTextActive: { color: colors.onAccent },
  moreRow: { minHeight: MIN_TARGET, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: SCREEN_MARGIN },
  moreText: { flex: 1, fontSize: font.body, fontFamily: fontFamily.semiBold, color: colors.text },
  moreValue: { fontSize: font.body, fontFamily: fontFamily.bold, color: colors.accent },
  option: { minHeight: MIN_TARGET, flexDirection: "row", alignItems: "center", paddingHorizontal: SCREEN_MARGIN },
  optionText: { flex: 1, fontSize: font.body, fontFamily: fontFamily.regular, color: colors.text },
  optionTextActive: { fontFamily: fontFamily.bold },
});
