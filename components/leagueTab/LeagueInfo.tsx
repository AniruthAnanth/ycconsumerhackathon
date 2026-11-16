import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Icon, SectionLabel } from "@/components/ui";
import { BORDER, colors, font, fontFamily, layout, radius, SCREEN_MARGIN, spacing } from "@/theme";

type Props = {
  /** Shown muted at the end of the row while it is closed, so the code is readable without opening it. */
  hint?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * One inset-grouped chevron row that opens everything secondary on the League tab (details, invite,
 * notifications, odds, leaderboards). The tab itself answers "where do I stand and what's the pot?",
 * so the rest stays one tap away instead of off the screen.
 */
export function LeagueInfo({ hint, children, style }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <View style={style}>
      <SectionLabel left="League" />
      <View style={styles.group}>
        <Pressable
          style={styles.row}
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel="League info"
          testID="league-info-toggle"
        >
          <Icon name="information-circle-outline" size={22} color={colors.textMuted} />
          <Text style={styles.label}>League info</Text>
          {hint && !open ? <Text style={styles.hint}>{hint}</Text> : null}
          <Icon name={open ? "chevron-down" : "chevron-forward"} size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginHorizontal: SCREEN_MARGIN, borderRadius: radius.card, borderWidth: BORDER, borderColor: colors.cardBorder, backgroundColor: colors.surface, overflow: "hidden" },
  row: { minHeight: layout.rowMin + spacing.sm, flexDirection: "row", alignItems: "center", gap: layout.columnGap, paddingHorizontal: spacing.lg },
  label: { flex: 1, fontFamily: fontFamily.regular, fontSize: font.body, color: colors.text },
  hint: { fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted },
  body: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
});
