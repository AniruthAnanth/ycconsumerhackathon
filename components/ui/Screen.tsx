import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { colors } from "@/theme";

type Props = {
  children: ReactNode;
  /** Wraps the content in a ScrollView that keeps taps working while the keyboard is up. */
  scroll?: boolean;
  /** Safe-area edges to pad. A tab screen passes ["bottom"], since the tab header owns the top. */
  edges?: readonly Edge[];
};

/** The white, safe-area page every screen sits on. */
export function Screen({ children, scroll = false, edges = ["top", "bottom"] }: Props) {
  return (
    <SafeAreaView style={styles.page} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
});
