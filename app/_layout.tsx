import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthGate } from "@/components/AuthGate";
import { convex } from "@/lib/convex";
import { tokenStorage } from "@/lib/tokenStorage";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <ConvexAuthProvider client={convex} storage={tokenStorage}>
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </AuthGate>
      <StatusBar style="dark" />
    </ConvexAuthProvider>
  );
}
