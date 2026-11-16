import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Header, Icon, RowDivider, sheetNeedsClose } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentLeague } from "@/lib/currentLeague";
import { stakeLine } from "@/lib/leagueText";
import { haptics } from "@/lib/native/haptics";
import { colors, font, fontFamily, layout, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing } from "@/theme";

/**
 * The sheet the header's league name opens (app/league-switcher.tsx, a native form sheet sized
 * to its rows): the player's leagues, then a way into another. It sizes to its content, so
 * nothing here may use flex: 1.
 */
export function LeagueSwitcher() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { me, leagueId, setLeagueId } = useCurrentLeague();

  // A web form sheet has no swipe-down, so Escape is the keyboard way out.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

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
      <Header title="Your leagues" onClose={sheetNeedsClose ? () => router.back() : undefined} />
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
          <RowDivider inset={SCREEN_MARGIN} />
        </Pressable>
      ))}
      <Pressable style={styles.row} onPress={join} accessibilityRole="button" accessibilityLabel="Join or create a league">
        <Icon name="add" color={colors.accent} />
        <Text style={styles.join}>Join or create a league</Text>
        <RowDivider inset={SCREEN_MARGIN} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Room above the first row for the sheet's grabber.
  list: { backgroundColor: colors.background, paddingTop: spacing.lg },
  row: {
    minHeight: ROW_HEIGHT_COMPACT,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1 },
  name: { fontSize: font.title, fontFamily: fontFamily.bold, color: colors.text },
  meta: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  join: { fontSize: font.title, fontFamily: fontFamily.bold, color: colors.accent },
});
