import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Banner, PositionPill, SectionLabel } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import {
  colors,
  font,
  fontFamily,
  layout,
  SCREEN_MARGIN,
  spacing,
  tabular,
} from "@/theme";

import type { TaskVeto } from "../contract";
import { myStruck, struckBanner, upForVeto } from "./vetoLogic";
import { VetoChip } from "./VetoChip";

/** Above the feed: tasks the league can still veto, and a nudge when mine was struck. Empty when there is neither. */
export function UpForVeto({
  board,
  leagueId,
  myUserId,
  now,
}: {
  board: TaskVeto[] | undefined;
  leagueId: Id<"leagues">;
  myUserId: Id<"users"> | undefined;
  now: number;
}) {
  const router = useRouter();
  const open = upForVeto(board, myUserId, now);
  const struck = myStruck(board, myUserId)[0];
  if (!struck && open.length === 0) return null;

  return (
    <View testID="up-for-veto">
      {struck ? (
        <Banner
          title={struckBanner(struck.title)}
          icon="alert-circle"
          onPress={() => router.navigate("/matchup")}
        />
      ) : null}
      {open.length > 0 ? <SectionLabel left="Up for veto" /> : null}
      {open.map((veto) => (
        <View key={veto.taskId} style={styles.row}>
          <PositionPill slot={veto.slot} />
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={2}>
              {veto.title}
            </Text>
            <Text style={styles.owner} numberOfLines={1}>
              {veto.ownerName}
            </Text>
            <VetoChip veto={veto} leagueId={leagueId} />
          </View>
          <Text style={styles.points}>{veto.points}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.rowMin,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, gap: spacing.xs },
  title: {
    color: colors.text,
    fontSize: font.body,
    fontFamily: fontFamily.bold,
  },
  owner: {
    color: colors.textMuted,
    fontSize: font.meta,
    fontFamily: fontFamily.semiBold,
  },
  points: {
    width: layout.numericColumn,
    textAlign: "right",
    color: colors.text,
    fontSize: font.score,
    fontFamily: fontFamily.extraBold,
    ...tabular,
  },
});
