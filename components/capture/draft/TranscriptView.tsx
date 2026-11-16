import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, duration, fontFamily, radius, spacing, type } from "@/theme";

import type { DraftPhase } from "./draftState";
import { pushLevel } from "./recordingMeter";
import { useWordReveal } from "./useWordReveal";

type Props = {
  phase: DraftPhase;
  transcript: string;
  /** What the player has said so far, while recording. */
  liveTranscript: string;
  /** Microphone loudness from 0 to 1, while recording. */
  level: number;
  onRevealFinished: () => void;
};

export function TranscriptView({ phase, transcript, liveTranscript, level, onRevealFinished }: Props) {
  const text = useWordReveal(transcript, phase === "revealing", onRevealFinished);

  if (phase === "recording") return <LiveTranscript text={liveTranscript} level={level} />;
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
    // Three lines while it types too: the lineup sits right under it and must not be pushed around.
    <Text style={styles.transcript} numberOfLines={3}>
      {text}
    </Text>
  );
}

const BARS = 24;
const BAR_MAX_HEIGHT = 20;
const CARET_BLINK_MS = duration.slow + duration.base;

/** The words so far behind a blinking caret, over a waveform that moves with the voice, so it visibly listens. */
function LiveTranscript({ text, level }: { text: string; level: number }) {
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [caretOn, setCaretOn] = useState(true);

  useEffect(() => setLevels((history) => pushLevel(history, level, BARS)), [level]);
  useEffect(() => {
    const blink = setInterval(() => setCaretOn((on) => !on), CARET_BLINK_MS);
    return () => clearInterval(blink);
  }, []);

  return (
    <View style={styles.live}>
      <View style={styles.liveHeader}>
        <Text style={styles.status}>LISTENING</Text>
        <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {levels.map((value, index) => (
            <View key={index} style={[styles.bar, { height: 2 + value * (BAR_MAX_HEIGHT - 2) }]} />
          ))}
        </View>
      </View>
      {/* The newest words matter most, so a long take drops its start rather than its end. */}
      <Text style={styles.liveText} numberOfLines={3} ellipsizeMode="head" accessibilityLiveRegion="polite">
        {text}
        <Text style={[styles.caret, !caretOn && styles.caretOff]}>|</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { ...type.caption, fontFamily: fontFamily.bold, letterSpacing: 0.6, color: colors.accent },
  working: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  transcript: { ...type.body, color: colors.textMuted },
  live: { gap: spacing.sm },
  liveHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  wave: { flexDirection: "row", alignItems: "center", gap: 2, height: BAR_MAX_HEIGHT },
  bar: { width: 3, borderRadius: radius.sm, backgroundColor: colors.accent, opacity: 0.6 },
  liveText: { ...type.body, color: colors.text, minHeight: type.body.lineHeight * 3 },
  caret: { color: colors.accent },
  caretOff: { color: "transparent" },
});
