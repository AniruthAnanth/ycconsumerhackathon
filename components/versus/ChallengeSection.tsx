import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { OutlinedPillButton, SectionLabel } from "@/components/ui";
import { spacing } from "@/theme";

/** First on the join screen: a versus needs one friend, so it is the way in for someone with no league to find. */
export function ChallengeSection({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  return (
    <>
      <SectionLabel left="Challenge a friend" />
      <View style={styles.body}>
        <OutlinedPillButton label="1v1 for a week" icon="flash-outline" disabled={disabled} onPress={() => router.push("/versus/new")} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.md },
});
