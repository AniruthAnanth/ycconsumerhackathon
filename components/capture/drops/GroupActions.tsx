import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { OutlinedPillButton } from "@/components/ui";
import { colors, font, spacing } from "@/theme";

import type { DropView } from "./dropView";

type GroupView = Extract<DropView, { type: "group" }>;

/** A group session: time to the start, or to the end once it is on, and who is in. */
export function GroupActions({ view }: { view: GroupView }) {
  const router = useRouter();
  const phase = view.started ? "ENDS IN" : "STARTS IN";

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.countdown}>{view.countdown}</Text>
        <Text style={styles.details} numberOfLines={1}>{`${phase}  ·  ${view.attending} IN`}</Text>
      </View>
      <OutlinedPillButton label="View" onPress={() => router.push(`/group/${view.dropId}`)} />
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
});
