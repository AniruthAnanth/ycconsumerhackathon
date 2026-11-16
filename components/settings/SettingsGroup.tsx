import { Children, Fragment, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, hairline, radius, SCREEN_MARGIN, spacing } from "@/theme";

type Props = {
  /** The small uppercase header above the card. */
  title?: string;
  /** A muted note under the card, as iOS Settings explains a group. */
  footer?: string;
  children: ReactNode;
};

/**
 * One inset group of an iOS-style settings list: a header, a rounded card of rows with hairlines
 * between them, and an optional footer. Rows that render nothing leave no divider behind.
 */
export function SettingsGroup({ title, footer, children }: Props) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.group}>
      {title ? <Text style={styles.header}>{title.toUpperCase()}</Text> : null}
      <View style={styles.card}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: spacing.xl, paddingHorizontal: SCREEN_MARGIN, gap: spacing.sm },
  header: {
    paddingHorizontal: spacing.lg,
    fontSize: font.label,
    fontFamily: fontFamily.bold,
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden" },
  // Starts where the row text starts, as in an iOS inset list.
  divider: { height: hairline, marginLeft: spacing.lg, backgroundColor: colors.divider },
  footer: { paddingHorizontal: spacing.lg, fontSize: font.meta, fontFamily: fontFamily.regular, color: colors.textMuted },
});
