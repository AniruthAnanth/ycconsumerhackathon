import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthGate } from "@/components/AuthGate";
import { NotificationsHost } from "@/components/notifications/NotificationsHost";
import { convex } from "@/lib/convex";
import { CurrentLeagueProvider } from "@/lib/currentLeague";
import { tokenStorage } from "@/lib/tokenStorage";
import { colors } from "@/theme";

export { RootError as ErrorBoundary } from "@/components/shell/RootError";

export default function RootLayout() {
  return (
    // Swipe actions (react-native-gesture-handler) only receive touches under this root view.
    <GestureHandlerRootView style={styles.root}>
      <ConvexAuthProvider client={convex} storage={tokenStorage}>
        <AuthGate>
          <CurrentLeagueProvider>
            {/* Draws nothing: raises notifications from the live queries and opens the screen a tapped one names. */}
            <NotificationsHost />
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
              <Stack.Screen name="league-switcher" options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents", sheetGrabberVisible: true }} />
              <Stack.Screen name="group/new" options={{ presentation: "formSheet", sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true }} />
            </Stack>
          </CurrentLeagueProvider>
        </AuthGate>
        <StatusBar style="dark" />
      </ConvexAuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
