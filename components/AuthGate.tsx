import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontFamily, spacing } from "@/theme";

/**
 * Signs the device in anonymously on first launch and renders the app only
 * once a session exists, so every screen below can assume a signed-in user.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [failed, setFailed] = useState(false);
  // Each anonymous sign-in creates a new account, so a second call while the
  // first is in flight would leave an orphan user behind.
  const signingIn = useRef(false);

  useEffect(() => {
    if (isLoading || isAuthenticated || failed || signingIn.current) {
      return;
    }
    signingIn.current = true;
    signIn("anonymous")
      .catch(() => setFailed(true))
      .finally(() => {
        signingIn.current = false;
      });
  }, [isLoading, isAuthenticated, failed, signIn]);

  if (isAuthenticated) {
    return children;
  }
  return (
    <View style={styles.screen}>
      {failed ? (
        <Pressable onPress={() => setFailed(false)} hitSlop={spacing.lg}>
          <Text style={styles.retry}>Couldn't connect. Tap to retry.</Text>
        </Pressable>
      ) : (
        <ActivityIndicator color={colors.textMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  retry: {
    color: colors.accent,
    fontSize: 15,
    fontFamily: fontFamily.semiBold,
  },
});
