import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, fontFamily } from "@/theme";

/**
 * What a social screen shows in place of its content: a spinner while its query
 * loads, otherwise one muted line (nothing here yet, or what went wrong).
 */
export function ScreenState({ loading, message }: { loading?: boolean; message?: string }) {
  return (
    <View style={styles.state}>
      {loading ? <ActivityIndicator color={colors.textMuted} /> : <Text style={styles.text}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: colors.background },
  text: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 15, textAlign: "center" },
});
