import { StyleSheet, Text } from "react-native";

import { Card, OutlinedPillButton } from "@/components/ui";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing } from "@/theme";

import { useTextSunny } from "./useTextSunny";

/** The end of onboarding's invitation to play by text: one line on what to text, one button. */
export function TextSunnyCard() {
  const sunny = useTextSunny();
  if (!sunny.ready) return null;

  return (
    <Card style={styles.card} testID="text-sunny-card">
      <Text style={styles.title}>Text Sunny</Text>
      <Text style={styles.copy}>
        Text {sunny.number} for STANDINGS, a photo to prove a task, or any question about your league.
      </Text>
      {/* Outlined: the screen's one filled button is its own next step. */}
      <OutlinedPillButton label="Text Sunny" onPress={() => void sunny.open()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: SCREEN_MARGIN, marginTop: spacing.md, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: font.title, fontFamily: fontFamily.bold, color: colors.text },
  copy: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
});
