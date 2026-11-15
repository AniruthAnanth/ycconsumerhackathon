import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { OutlinedPillButton } from "@/components/ui";
import { spacing } from "@/theme";

/** The way into a new versus, placed under Matchup and on the join screen. */
export function ChallengeButton() {
  const router = useRouter();
  return (
    <View style={styles.body}>
      <OutlinedPillButton label="Challenge a friend" icon="flash-outline" onPress={() => router.push("/versus/new")} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.md },
});
