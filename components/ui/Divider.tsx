import { StyleSheet, View } from "react-native";

import { colors, hairline } from "@/theme";

/** The hairline between rows. `inset` starts it past a row's leading column. */
export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.line, { marginLeft: inset }]} />;
}

const styles = StyleSheet.create({
  line: { height: hairline, backgroundColor: colors.divider },
});
