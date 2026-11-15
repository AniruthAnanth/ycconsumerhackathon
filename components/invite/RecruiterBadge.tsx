import { useQuery } from "convex/react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { colors, font, spacing } from "@/theme";

import { recruiterPillText } from "./inviteRoute";

/** "RECRUITER · 3 friends · +75" under a player's name; nothing until they have earned the badge. */
export function RecruiterBadge({ userId }: { userId: Id<"users"> }) {
  const summary = useQuery(api.referrals.forUser, { userId });
  const text = summary ? recruiterPillText(summary) : null;
  if (!text) return null;
  return (
    <View style={styles.pill} accessible accessibilityLabel={text}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.accentTint,
  },
  text: { fontSize: font.label, fontWeight: "700", letterSpacing: 0.5, color: colors.accent },
});
