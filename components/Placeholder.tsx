import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme";

/** Stand-in body for a tab until the app thread builds the real screen. */
export function Placeholder({ title }: { title: string }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{title}</Text>
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
  title: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
});
