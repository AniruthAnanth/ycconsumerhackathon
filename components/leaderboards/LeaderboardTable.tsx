import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Divider } from "@/components/ui";
import { colors, font, hairline, spacing } from "@/theme";

import { LeaderboardRow, MOVEMENT_WIDTH, RANK_WIDTH } from "./LeaderboardRow";
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
  return (
    <View>
      <View style={styles.header}>
        <Text style={[styles.label, styles.rank]}>RK</Text>
        <Text style={[styles.label, styles.player]}>PLAYER</Text>
        <Text style={styles.label}>{valueHeader.toUpperCase()}</Text>
      </View>
      {rows?.length === 0 ? <Text style={styles.empty}>No results yet</Text> : null}
      {rows?.map((row, index) => (
        <View key={row.userId}>
          {index > 0 ? <Divider inset={spacing.md} /> : null}
          <LeaderboardRow row={row} onPress={() => router.push(`/profile/${row.userId}`)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: colors.strip,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  label: { fontSize: font.label, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.6 },
  // Rank and movement are separate columns in a row but one header cell here, so PLAYER lines up with the avatar.
  rank: { width: RANK_WIDTH + MOVEMENT_WIDTH + spacing.sm },
  player: { flex: 1 },
  empty: { paddingVertical: spacing.xl, textAlign: "center", fontSize: font.body, color: colors.textMuted },
});
