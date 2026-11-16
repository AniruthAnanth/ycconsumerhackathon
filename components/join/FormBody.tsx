import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";

import { layout, spacing } from "@/theme";

/**
 * The body under the top bar on a form screen. It lifts with the keyboard and scrolls when the
 * content is taller than what the keyboard leaves. The footer (the screen's primary button) sits
 * outside the scroll, so it stays above the keyboard however tall the form is, and at the same
 * height as the intro's button.
 */
export function FormBody({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  footer: { paddingHorizontal: layout.margin, paddingTop: spacing.md, paddingBottom: spacing.lg },
});
