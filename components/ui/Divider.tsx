import { StyleSheet, View } from "react-native";

import { colors, hairline } from "@/theme";

/**
 * The hairline between rows. `inset` starts it where the row's text starts (TASK_TEXT_INSET,
 * PERSON_TEXT_INSET or SCREEN_MARGIN), as iOS lists do, so dividers and text share one edge.
 */
export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.line, { marginLeft: inset }]} />;
}

/** The same hairline drawn along a row's bottom edge, for rows that own their divider. */
export function RowDivider({ inset }: { inset: number }) {
  return <View style={[styles.line, styles.bottom, { left: inset }]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  line: { height: hairline, backgroundColor: colors.listDivider },
  bottom: { position: "absolute", right: 0, bottom: 0 },
});
