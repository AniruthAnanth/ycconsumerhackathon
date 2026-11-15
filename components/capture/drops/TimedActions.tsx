import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui";
import { haptics } from "@/lib/native/haptics";
import { colors, font, spacing } from "@/theme";

import { proofCameraHref } from "../proofRoute";
import type { DropView } from "./dropView";

type TimedView = Extract<DropView, { type: "timed" }>;

/** A quick-time drop, or a mystery task already opened: time left, what to show, and Submit. */
export function TimedActions({ view }: { view: TimedView }) {
  const router = useRouter();
  const { proof } = view;
  const details = [view.gesture?.toUpperCase(), `${view.points} PTS`, view.wager ? `WAGER ${view.wager}` : undefined];

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.countdown}>{view.countdown}</Text>
        <Text style={styles.details} numberOfLines={1}>
          {details.filter(Boolean).join("  ·  ")}
        </Text>
      </View>
      {proof ? (
        <Button
          label="Submit"
          style={styles.submit}
          onPress={() => {
            haptics.select();
            router.push(proofCameraHref(proof));
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  info: { flexShrink: 1, alignItems: "flex-end", gap: 2 },
  countdown: {
    color: colors.background,
    fontSize: font.total,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  details: { color: colors.divider, fontSize: font.label, fontWeight: "700", letterSpacing: 0.6 },
  submit: { height: 36, paddingHorizontal: spacing.lg },
});
