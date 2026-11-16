import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Banner, Divider, Icon, PositionPill, RowDivider } from "@/components/ui";
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

// A veto row has the pill but no thumbnail, so its text (and its divider) start one column in.
const TEXT_INSET = SCREEN_MARGIN + layout.pillColumn + layout.columnGap;

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
  const [expanded, setExpanded] = useState(false);
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
      {/* One compact row with the count, so the posts lead; the list opens in place. */}
      {open.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Up for veto, ${open.length}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={styles.summary}
        >
          <Text style={styles.summaryText}>Up for veto</Text>
          <Text style={styles.count}>{open.length}</Text>
          <Icon name={expanded ? "chevron-down" : "chevron-forward"} size={font.body} color={colors.textMuted} />
        </Pressable>
      ) : null}
      {(expanded ? open : []).map((veto) => (
        <View key={veto.taskId} style={styles.row}>
          <PositionPill slot={veto.slot} />
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={2}>
              {veto.title}
            </Text>
            <Text style={styles.owner} numberOfLines={1}>
              {veto.ownerName}
            </Text>
            <View style={styles.chip}>
              <VetoChip veto={veto} leagueId={leagueId} />
            </View>
          </View>
          <Text style={styles.points}>{veto.points}</Text>
          <RowDivider inset={TEXT_INSET} />
        </View>
      ))}
      {open.length > 0 ? <Divider /> : null}
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
  chip: { alignItems: "flex-start" },
  summary: { minHeight: layout.rowMin, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: SCREEN_MARGIN },
  summaryText: { flex: 1, color: colors.text, fontSize: font.body, fontFamily: fontFamily.semiBold },
  count: { color: colors.textMuted, fontSize: font.body, fontFamily: fontFamily.semiBold, ...tabular },
  title: {
    color: colors.text,
    fontSize: font.title,
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
    fontFamily: fontFamily.bold,
    ...tabular,
  },
});
