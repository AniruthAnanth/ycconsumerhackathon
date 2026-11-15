import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthGate } from "@/components/AuthGate";
import { convex } from "@/lib/convex";
import { CurrentLeagueProvider } from "@/lib/currentLeague";
import { tokenStorage } from "@/lib/tokenStorage";
import { colors } from "@/theme";

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
            <Stack.Screen name="task/[taskId]" options={{ presentation: "modal" }} />
            <Stack.Screen name="proof/[taskId]" options={{ presentation: "fullScreenModal" }} />
            <Stack.Screen name="wrapped/index" options={{ presentation: "fullScreenModal" }} />
          </Stack>
        </CurrentLeagueProvider>
      </AuthGate>
      <StatusBar style="dark" />
    </ConvexAuthProvider>
  );
}
