import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Divider } from "@/components/ui";
import { colors, font, fontFamily, hairline, layout, SCREEN_MARGIN, spacing } from "@/theme";

import { hasMovement, tiedRanks } from "./format";
import { LeaderboardRow, MOVEMENT_WIDTH, RANK_WIDTH, rowTextInset, VALUE_WIDTH } from "./LeaderboardRow";
import type { BoardRow } from "./types";

type Props = {
  /** The right-hand column name, for example "PTS". */
  valueHeader: string;
  /** Undefined while the query loads: only the header shows. */
  rows: readonly BoardRow[] | undefined;
};

/** The ESPN standings table. It does not scroll itself; the screen's ScrollView does. */
export function LeaderboardTable({ valueHeader, rows }: Props) {
  const router = useRouter();
  const tied = tiedRanks(rows ?? []);
  const showMovement = hasMovement(rows ?? []);
  return (
    <View>
      <View style={styles.header}>
        <Text style={[styles.label, styles.rank, showMovement && styles.rankWithMovement]}>RK</Text>
        <Text style={[styles.label, styles.player]}>PLAYER</Text>
        <Text style={[styles.label, styles.value]}>{valueHeader.toUpperCase()}</Text>
      </View>
      {rows?.length === 0 ? <Text style={styles.empty}>No results yet</Text> : null}
      {rows?.map((row, index) => (
        <View key={row.userId}>
          {index > 0 ? <Divider inset={rowTextInset(showMovement)} /> : null}
          <LeaderboardRow row={row} tied={tied.has(row.rank)} showMovement={showMovement} onPress={() => router.push(`/profile/${row.userId}`)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SCREEN_MARGIN,
    gap: layout.columnGap,
    backgroundColor: colors.strip,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  label: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted, letterSpacing: 0.6 },
  rank: { width: RANK_WIDTH },
  // Rank and movement are separate columns in a row but one header cell here, so PLAYER lines up with the avatar.
  rankWithMovement: { width: RANK_WIDTH + MOVEMENT_WIDTH + layout.columnGap },
  player: { flex: 1 },
  value: { width: VALUE_WIDTH, textAlign: "right" },
  empty: { paddingVertical: spacing.xl, textAlign: "center", fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted },
});
