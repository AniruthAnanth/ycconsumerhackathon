import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { colors, font, hairline, spacing } from "@/theme";

import { seasonProgress, settingsSummary } from "./settings";

/** The League tab's way into the Season screen: one row saying where the season stands. */
export function SeasonLink({ leagueId }: { leagueId: Id<"leagues"> }) {
  const router = useRouter();
  const season = useQuery(api.seasons.overview, { leagueId });
  // The row is a shortcut, not content: it appears once there is something to say.
  if (season === undefined) return null;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: "/league-settings/season", params: { leagueId } })}
      accessibilityRole="button"
      accessibilityLabel="Season"
    >
      <View style={styles.text}>
        <Text style={styles.title}>{seasonProgress(season.season, season.currentWeek, season.settings.seasonWeeks)}</Text>
        <Text style={styles.detail}>{settingsSummary(season.settings)}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  pressed: { backgroundColor: colors.accentTint },
  text: { flex: 1, gap: 2 },
  title: { fontSize: font.title, fontWeight: "700", color: colors.text },
  detail: { fontSize: font.meta, color: colors.textMuted },
});
