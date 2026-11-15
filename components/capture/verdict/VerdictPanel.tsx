import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Divider } from "@/components/ui";
import { colors, spacing } from "@/theme";

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
    <Pressable onPress={onPress} hitSlop={8} style={styles.close}>
      <Text style={styles.closeLabel}>Close</Text>
    </Pressable>
  );
}

/** Everything under the media: the reason first, then the points, then the one action. */
export function VerdictPanel({ phase, onDone, onRetry, onClose, whileReviewing }: Props) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, spacing.lg);

  if (phase.name === "reviewing") return <View style={styles.panel}>{whileReviewing}</View>;

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
  return (
    <View style={[styles.panel, { paddingBottom: bottom }]}>
      <FadeIn delay={REASON_DELAY_MS}>
        <Text style={styles.reason}>{verdict.reason}</Text>
      </FadeIn>
      <FadeIn delay={POINTS_DELAY_MS}>
        <Divider />
        <View style={styles.pointsRow}>
          {verdict.closeCall ? <Text style={styles.closeCall}>CLOSE CALL</Text> : <View />}
          <PointsCounter points={verdict.points} pass={verdict.pass} delay={POINTS_DELAY_MS} />
        </View>
        <Divider />
      </FadeIn>
      <View style={styles.spacer} />
      <FadeIn delay={ACTIONS_DELAY_MS}>
        {verdict.pass ? (
          <Button label="Done" onPress={onDone} />
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
  panel: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  reason: { color: colors.text, fontSize: 24, fontWeight: "600", lineHeight: 31, marginBottom: spacing.xl },
  pointsRow: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeCall: {
    color: colors.textMuted,
    borderColor: colors.divider,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  spacer: { flex: 1 },
  actions: { gap: spacing.sm },
  close: { alignItems: "center", paddingVertical: spacing.md },
  closeLabel: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
});
