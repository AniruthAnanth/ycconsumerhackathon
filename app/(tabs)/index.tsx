import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { OutlinedPillButton, Screen, SectionLabel } from "@/components/ui";
import { spacing } from "@/theme";

/** ROSTER, the home tab. The task list arrives with the lineup query. */
export default function RosterScreen() {
  const router = useRouter();
  return (
    <Screen edges={["bottom"]}>
      <View style={styles.actions}>
        <OutlinedPillButton label="Voice Draft" icon="mic-outline" style={styles.action} onPress={() => router.push("/draft")} />
        <OutlinedPillButton label="Week Stats" icon="stats-chart-outline" style={styles.action} onPress={() => router.push("/wrapped")} />
      </View>
      <SectionLabel left="Starters" right="Score" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: spacing.md, padding: spacing.md },
  action: { flex: 1 },
});
