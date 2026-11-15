import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, font, spacing } from "@/theme";

import type { DraftPhase } from "./draftState";
import { useWordReveal } from "./useWordReveal";

type Props = {
  phase: DraftPhase;
  transcript: string;
  onRevealFinished: () => void;
};

export function TranscriptView({ phase, transcript, onRevealFinished }: Props) {
  const text = useWordReveal(transcript, phase === "revealing", onRevealFinished);

  if (phase === "recording") return <Text style={styles.status}>LISTENING</Text>;
  if (phase === "drafting") {
    return (
      <View style={styles.working}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.status}>DRAFTING</Text>
      </View>
    );
  }
  if (phase === "idle") return null;
  return (
    <Text style={styles.transcript} numberOfLines={phase === "revealing" ? undefined : 3}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  status: { fontSize: font.label, fontWeight: "700", letterSpacing: 0.6, color: colors.accent },
  working: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  transcript: { fontSize: font.body, lineHeight: 20, color: colors.textMuted },
});
