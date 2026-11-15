import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { type ErrorBoundaryProps, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import { AuthGate } from "@/components/AuthGate";
import { OutlinedPillButton } from "@/components/ui";
import { convex } from "@/lib/convex";
import { CurrentLeagueProvider } from "@/lib/currentLeague";
import { tokenStorage } from "@/lib/tokenStorage";
import { colors, font, spacing } from "@/theme";

export default function RootLayout() {
  return (
    <ConvexAuthProvider client={convex} storage={tokenStorage}>
      <AuthGate>
        <CurrentLeagueProvider>
          {/* Every screen draws its own Header from components/ui, so the native one stays hidden. */}
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="task/[taskId]" options={{ presentation: "formSheet", sheetAllowedDetents: [0.45, 1], sheetGrabberVisible: true, sheetCornerRadius: 16 }} />
            <Stack.Screen name="proof/[taskId]" options={{ presentation: "fullScreenModal" }} />
            <Stack.Screen name="wrapped/index" options={{ presentation: "fullScreenModal" }} />
          </Stack>
        </CurrentLeagueProvider>
      </AuthGate>
      <StatusBar style="dark" />
    </ConvexAuthProvider>
  );
}

/**
 * CurrentLeagueProvider reads users.me() above every screen, so when that read
 * fails (no connection, or the backend is mid-deploy) no screen is left to show
 * the failure. Expo Router renders this in place of the whole app instead of a
 * blank page; Try Again mounts everything afresh.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
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
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  message: { fontSize: font.title, color: colors.textMuted },
});
