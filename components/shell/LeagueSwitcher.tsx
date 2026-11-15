import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentLeague } from "@/lib/currentLeague";
import { stakeLine } from "@/lib/leagueText";
import { haptics } from "@/lib/native/haptics";
import { colors, font, hairline, spacing } from "@/theme";

/**
 * The sheet the header's league name opens (app/league-switcher.tsx, a native form sheet sized
 * to its rows): the player's leagues, then a way into another. It sizes to its content, so
 * nothing here may use flex: 1.
 */
export function LeagueSwitcher() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { me, leagueId, setLeagueId } = useCurrentLeague();

  function pick(id: Id<"leagues">) {
    if (id !== leagueId) haptics.select();
    setLeagueId(id);
    router.back();
  }

  function join() {
    // Close the sheet first, so Join is pushed on the app rather than stacked inside the sheet.
    router.back();
    router.push("/join");
  }

  return (
    <View style={[styles.list, { paddingBottom: insets.bottom }]}>
      {(me?.leagues ?? []).map((league) => (
        <Pressable
          key={league._id}
          style={styles.row}
          onPress={() => pick(league._id)}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${league.name}, ${stakeLine(league).replace(" | ", ", ")}`}
          accessibilityState={{ selected: league._id === leagueId }}
        >
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>
              {league.name}
            </Text>
            <Text style={styles.meta}>{stakeLine(league)}</Text>
          </View>
          {league._id === leagueId ? <Icon name="checkmark" color={colors.tabActive} /> : null}
        </Pressable>
      ))}
      <Pressable style={styles.row} onPress={join} accessibilityRole="button" accessibilityLabel="Join or create a league">
        <Icon name="add" color={colors.accent} />
        <Text style={styles.join}>Join or create a league</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Room above the first row for the sheet's grabber.
  list: { backgroundColor: colors.background, paddingTop: spacing.lg },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  text: { flex: 1, gap: 1 },
  name: { fontSize: font.title, fontWeight: "700", color: colors.text },
  meta: { fontSize: font.meta, color: colors.textMuted },
  join: { fontSize: font.title, fontWeight: "700", color: colors.accent },
});
