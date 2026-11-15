import type { ErrorBoundaryProps } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { OutlinedPillButton } from "@/components/ui";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing } from "@/theme";

/**
 * CurrentLeagueProvider reads users.me() above every screen, so when that read
 * fails (no connection, or the backend is mid-deploy) no screen is left to show
 * the failure. Expo Router renders this in place of the whole app instead of a
 * blank page; Try Again mounts everything afresh.
 */
export function RootError({ retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.failure}>
      <Text style={styles.message}>Couldn't reach Lineup.</Text>
      <OutlinedPillButton label="Try Again" onPress={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  failure: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: SCREEN_MARGIN,
    backgroundColor: colors.background,
  },
  message: { fontFamily: fontFamily.regular, fontSize: font.title, color: colors.textMuted },
});
