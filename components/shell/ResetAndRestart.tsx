import { useAuthActions } from "@convex-dev/auth/react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { confirmAction } from "@/components/social/notify";
import { api } from "@/convex/_generated/api";
import { colors, layout, SCREEN_MARGIN, spacing, type } from "@/theme";

/**
 * Back to a brand-new player in one go: the backend account and everything hanging off it,
 * this device's storage and session, then the opening and onboarding. Each step runs even when
 * the one before it failed (a seeded player can't be deleted, an old backend lacks the mutation),
 * so it works from any state.
 */
export function useResetAndRestart() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const deleteAccount = useMutation(api.users.deleteAccount);
  return async () => {
    await deleteAccount({}).catch(() => {});
    await AsyncStorage.clear().catch(() => {});
    await signOut().catch(() => {});
    if (router.canDismiss()) router.dismissAll();
    router.replace("/how-it-works");
  };
}

/** The last row of the League tab in development and demo builds. */
export function ResetAndRestartRow() {
  const reset = useResetAndRestart();
  return (
    <Pressable
      style={styles.row}
      accessibilityRole="button"
      testID="dev-reset-restart"
      onPress={() =>
        confirmAction({
          title: "Reset and restart?",
          message: "This deletes this account and everything in it, signs out, and starts again from the opening.",
          confirmLabel: "Reset",
          onConfirm: () => void reset(),
        })
      }
    >
      <Text style={styles.label}>Developer: reset and restart</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: layout.rowMin, justifyContent: "center", paddingHorizontal: SCREEN_MARGIN, marginVertical: spacing.lg },
  label: { ...type.label, color: colors.danger },
});
