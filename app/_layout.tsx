import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, useFonts } from "@expo-google-fonts/nunito";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthGate } from "@/components/AuthGate";
import { NotificationsHost } from "@/components/notifications/NotificationsHost";
import { convex } from "@/lib/convex";
import { CurrentLeagueProvider } from "@/lib/currentLeague";
import { tokenStorage } from "@/lib/tokenStorage";
import { colors } from "@/theme";

export { RootError as ErrorBoundary } from "@/components/shell/RootError";

export default function RootLayout() {
  // The four Nunito weights the theme names (theme/tokens.ts fontFamily). A failed load falls back
  // to the system face rather than holding the app on a blank page.
  const [fontsLoaded, fontError] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  if (!fontsLoaded && !fontError) return <View style={[styles.root, { backgroundColor: colors.background }]} />;
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
              {/* The camera and the verdict photo fill the top of the screen, so their status bar is light, as on Wrapped. */}
              <Stack.Screen name="proof/[taskId]" options={{ presentation: "fullScreenModal", statusBarStyle: "light" }} />
              <Stack.Screen name="proof/verdict" options={{ statusBarStyle: "light" }} />
              {/* Wrapped draws full-bleed photos and dark cards, so its status bar is light; the native modal owns that, not expo-status-bar. */}
              <Stack.Screen name="wrapped/index" options={{ presentation: "fullScreenModal", statusBarStyle: "light" }} />
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
