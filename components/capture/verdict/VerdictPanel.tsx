import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Sunny } from "@/components/art";
import { ShareChallenge } from "@/components/invite";
import { SunnyVerdictLine } from "@/components/social/sunny/SunnyVerdictLine";
import { Button, Divider } from "@/components/ui";
import { BORDER, colors, font, fontFamily, MIN_TARGET, SCREEN_MARGIN, spacing, type } from "@/theme";

import { FadeIn } from "./FadeIn";
import { PointsCounter } from "./PointsCounter";
import { ACTIONS_DELAY_MS, POINTS_DELAY_MS, REASON_DELAY_MS } from "./timing";
import type { VerdictPhase } from "./verdictPhase";

type Props = {
  phase: VerdictPhase;
  onDone: () => void;
  onRetry: () => void;
  onClose: () => void;
  /** Shown under the media while the referee is still working, for example the on-device read. */
  whileReviewing?: ReactNode;
};

function CloseLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
      <Text style={styles.closeLabel}>Close</Text>
    </Pressable>
  );
}

/** Everything under the media: the reason first, then the points, then the one action. */
export function VerdictPanel({ phase, onDone, onRetry, onClose, whileReviewing }: Props) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, spacing.lg);

  // The caption over the media already says the referee is reviewing; the spinner only shows it is still working.
  if (phase.name === "reviewing") {
    return (
      <View style={styles.panel}>
        {whileReviewing}
        <ActivityIndicator style={styles.reviewing} color={colors.accent} testID="verdict-reviewing" />
      </View>
    );
  }

  if (phase.name === "error") {
    return (
      <View style={[styles.panel, { paddingBottom: bottom }]}>
        <Text style={styles.reason}>{phase.message}</Text>
        <View style={styles.actions}>
          <Button label="Retry" onPress={onRetry} />
          <CloseLink onPress={onClose} />
        </View>
      </View>
    );
  }

  const { verdict } = phase;
  // A held proof is neither a pass nor a fail yet, so it gets no points, no stamp and no Retry.
  if (verdict.needsVote) {
    return (
      <View style={[styles.panel, { paddingBottom: bottom }]} testID="verdict-vote">
        <Text style={styles.reason}>Sent to your league for a vote</Text>
        <Text style={[styles.reasonPass]}>{verdict.reason}</Text>
        <View style={styles.spacer} />
        <View style={styles.actions}>
          <Button label="Done" onPress={onDone} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.panel, { paddingBottom: bottom }]}>
      {verdict.pass ? (
        <FadeIn delay={REASON_DELAY_MS}>
          <View style={styles.pointsRow}>
            <View style={styles.pointsValue}>
              <PointsCounter points={verdict.points} delay={REASON_DELAY_MS} />
              <Text style={styles.pointsUnit}>pts</Text>
            </View>
            {verdict.closeCall ? <Text style={styles.closeCall}>CLOSE CALL</Text> : null}
          </View>
          <Divider />
        </FadeIn>
      ) : null}
      <FadeIn delay={POINTS_DELAY_MS}>
        {verdict.pass ? (
          <View style={styles.celebration}>
            <Sunny size={104} mood="success" delay={POINTS_DELAY_MS} entrance={false} />
          </View>
        ) : null}
        {verdict.pass ? <SunnyVerdictLine points={verdict.points} /> : null}
        <Text style={[styles.reason, verdict.pass && styles.reasonPass]}>{verdict.reason}</Text>
        {verdict.pass && verdict.caption ? (
          <Text style={styles.caption}>
            {verdict.caption}
          </Text>
        ) : null}
      </FadeIn>
      <View style={styles.spacer} />
      <FadeIn delay={ACTIONS_DELAY_MS}>
        {verdict.pass ? (
          <View style={styles.actions}>
            <Button label="Done" onPress={onDone} />
            <ShareChallenge />
          </View>
        ) : (
          <View style={styles.actions}>
            <Button label="Retry" onPress={onRetry} />
            <CloseLink onPress={onClose} />
          </View>
        )}
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.background, paddingHorizontal: SCREEN_MARGIN, paddingTop: spacing.xl },
  reason: { color: colors.text, fontSize: 24, fontFamily: fontFamily.semiBold, lineHeight: 31, marginBottom: spacing.xl },
  celebration: { alignSelf: "center", marginBottom: spacing.md },
  caption: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.body, marginTop: -spacing.lg, marginBottom: spacing.xl },
  reasonPass: { ...type.body, color: colors.textMuted, marginBottom: spacing.lg },
  pointsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  pointsValue: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  reviewing: { flex: 1 },
  pointsUnit: { ...type.label, color: colors.textMuted },
  closeCall: {
    color: colors.textMuted,
    borderColor: colors.divider,
    borderWidth: BORDER,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: font.label,
    fontFamily: fontFamily.bold,
    letterSpacing: 1.2,
  },
  spacer: { flex: 1 },
  actions: { gap: spacing.sm },
  close: { alignItems: "center", justifyContent: "center", minHeight: MIN_TARGET },
  closeLabel: { color: colors.textMuted, fontSize: font.body, fontFamily: fontFamily.semiBold },
});
