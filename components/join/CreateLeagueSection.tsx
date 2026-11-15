import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { OutlinedPillButton, SectionLabel } from "@/components/ui";
import { colors, SCREEN_MARGIN, spacing, type } from "@/theme";

/**
 * The way into the Create a League walkthrough (components/createLeague), which asks for the name,
 * who is playing, the stake and the season one step at a time. Nothing is asked here.
 */
export function CreateLeagueSection({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  return (
    <>
      <SectionLabel left="Create a league" />
      <View style={styles.body}>
        <Text style={styles.line}>Start your own league for your friends. We walk you through it in four short steps.</Text>
        <View style={styles.actions}>
          <OutlinedPillButton label="Create" icon="add-circle-outline" disabled={disabled} onPress={() => router.push("/create-league")} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.md, gap: spacing.md },
  line: { ...type.body, color: colors.textMuted },
  actions: { flexDirection: "row" },
});
