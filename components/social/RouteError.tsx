import type { ErrorBoundaryProps } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Header, OutlinedPillButton, Screen } from "@/components/ui";
import { errorMessage } from "@/lib/errorMessage";
import { colors, font, spacing } from "@/theme";

import { leaveScreen } from "./leave";

/**
 * What a social route shows when its screen throws. For these screens that means a query the
 * server turned down: a profile that no longer exists, a league the player has just left.
 * Expo Router renders a route's exported ErrorBoundary in place of the screen, so a bad read
 * costs one screen with a way to retry rather than the whole app.
 */
export function RouteError({ error, retry }: ErrorBoundaryProps) {
  return (
    <Screen>
      <Header title="Lineup" onBack={leaveScreen} />
      <Failure error={error} retry={retry} />
    </Screen>
  );
}

/** The same for a tab, whose header and tabs are already drawn by the tabs layout. */
export function TabError({ error, retry }: ErrorBoundaryProps) {
  return (
    <Screen edges={["bottom"]}>
      <Failure error={error} retry={retry} />
    </Screen>
  );
}

function Failure({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.failure}>
      <Text style={styles.message}>{errorMessage(error, "Couldn't load this.")}</Text>
      <OutlinedPillButton label="Try Again" onPress={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  failure: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.xl },
  message: { color: colors.textMuted, fontSize: font.title, textAlign: "center" },
});
