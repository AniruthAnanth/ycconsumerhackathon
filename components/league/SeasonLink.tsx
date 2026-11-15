import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { colors, font, fontFamily, hairline, spacing } from "@/theme";

import { seasonProgress, settingsSummary } from "./settings";

/** The League tab's way into the Season screen: one row saying where the season stands. */
export function SeasonLink({ leagueId }: { leagueId: Id<"leagues"> }) {
  return (
    <HideOnError>
      <SeasonRow leagueId={leagueId} />
    </HideOnError>
  );
}

function SeasonRow({ leagueId }: { leagueId: Id<"leagues"> }) {
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

/**
 * This row is mounted in the League tab, which another module owns. A failed
 * season query throws while rendering, and without a boundary of its own it
 * would take the pot and standings down with it; losing one shortcut is the
 * right price instead.
 */
class HideOnError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
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
  title: { fontSize: font.title, fontFamily: fontFamily.bold, color: colors.text },
  detail: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
});
