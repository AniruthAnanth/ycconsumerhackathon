import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/theme";

type Detents = number[] | "fitToContents";

/**
 * The one sheet presentation: every modal route slides up as a native form sheet
 * with the same grabber and corner radius, so task row → task sheet → capture
 * reads as one flow. app/_layout.tsx passes this to each sheet route.
 */
export function sheetOptions(detents: Detents = [0.5, 1]) {
  return {
    presentation: "formSheet" as const,
    sheetAllowedDetents: detents,
    sheetGrabberVisible: true,
    sheetCornerRadius: radius.card,
  };
}

/** The chrome of a sheet drawn in React Native (checkout): the native sheet's grabber and top corners. */
export const sheetSurface = {
  backgroundColor: colors.background,
  borderTopLeftRadius: radius.card,
  borderTopRightRadius: radius.card,
  overflow: "hidden" as const,
};

/** The grabber an in-app sheet draws, matching the native one. */
export function SheetGrabber() {
  return <View style={styles.grabber} />;
}

const styles = StyleSheet.create({
  grabber: { alignSelf: "center", width: 36, height: 5, marginTop: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.divider },
});
