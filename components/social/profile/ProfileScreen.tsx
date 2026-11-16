import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { formatChance, useMarket } from "@/components/markets";
import { areaPath, stepPath } from "@/components/markets/chartGeometry";
import { cardStyle, Header, LargeTitle, Screen, SLOT_LABEL, useCollapsingHeader } from "@/components/ui";
import { useCurrentLeague } from "@/lib/currentLeague";
import { SLOT_ORDER } from "@/lib/slots";
import { colors, font, fontFamily, radius, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import type { Id } from "@/convex/_generated/dataModel";
import { socialApi } from "../contract";
import { leaveScreen } from "../leave";
import { ScreenState } from "../ScreenState";
import { ProfileIdentity } from "./ProfileIdentity";

const NONE = "None yet";
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

/** A player's numbers at a glance: four tiles, this week's chance to clear every slot, and each slot's completion. */
export function ProfileScreen() {
  const { userId: rawUserId } = useLocalSearchParams<{ userId: string }>();
  const userId = rawUserId as Id<"users">;
  const profile = useQuery(socialApi.profile.get, { userId });
  const record = useQuery(socialApi.decree.get, { userId });
  const { me, leagueId } = useCurrentLeague();
  const market = useMarket(leagueId);
  const { scrollY, onScroll, contentInsetTop } = useCollapsingHeader();
  const own = me?._id === userId;
  const row = market?.odds.rows.find((r) => r.userId === userId);
  const finish = row?.finishChance;
  const history = (row?.finishHistory ?? []).map(({ at, chance }) => ({ at, value: chance }));
  const delta = history.length > 1 ? Math.round((history[history.length - 1].value - history[history.length - 2].value) * 100) : 0;
  const stats = record?.stats;
  const played = stats ? stats.wins + stats.losses > 0 : false;
  const slots = SLOT_ORDER.map((slot) => ({ slot, rate: profile?.slotRates?.find((s) => s.slot === slot)?.rate })).filter(
    (row): row is { slot: (typeof SLOT_ORDER)[number]; rate: number } => row.rate !== undefined,
  );

  return (
    <Screen edges={["bottom"]}>
      <Header title="Profile" onBack={leaveScreen} scrollY={scrollY} />
      <Animated.ScrollView
        contentContainerStyle={[styles.content, { paddingTop: contentInsetTop }]}
        scrollIndicatorInsets={{ top: contentInsetTop }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title="Profile" scrollY={scrollY} />
        {profile === undefined ? (
          <ScreenState loading />
        ) : (
          <View style={styles.body}>
            <View style={styles.card}>
              <ProfileIdentity userId={userId} name={profile.name} avatarUrl={profile.avatarUrl} own={own} />
            </View>
            <View style={styles.grid}>
              <Tile label="Season points" value={profile.totalPoints > 0 ? String(Math.round(profile.totalPoints)) : NONE} />
              <Tile label="Win-loss" value={stats && played ? `${stats.wins}-${stats.losses}` : NONE} />
              <Tile label="Current streak" value={profile.currentStreak > 0 ? `${profile.currentStreak} ${profile.currentStreak === 1 ? "day" : "days"}` : NONE} />
              <Tile label="Completion rate" value={profile.tasksCompleted > 0 ? percent(profile.completionRate) : NONE} />
            </View>
            {finish !== undefined ? (
              <View style={styles.card} testID="profile-clear-chance">
                <Text style={styles.label}>Chance to clear 5/5 this week</Text>
                <View style={styles.bigRow}>
                  <Text style={styles.big}>{formatChance(finish)}</Text>
                  {delta !== 0 ? (
                    <Text style={[styles.delta, { color: delta > 0 ? colors.green : colors.danger }]}>
                      {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} pts
                    </Text>
                  ) : null}
                </View>
                {history.length > 1 ? <ClearChart points={history} /> : null}
                {history.length > 1 ? (
                  <View style={styles.axis}>
                    <Text style={styles.label}>Week start</Text>
                    <Text style={styles.label}>Now</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <View style={styles.card}>
              {slots.length === 0 ? (
                <Text style={styles.label}>Slot completion: {NONE}</Text>
              ) : (
                slots.map(({ slot, rate }) => (
                  <View key={slot} style={styles.slotRow}>
                    <Text style={styles.slotName}>{SLOT_LABEL[slot]}</Text>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${Math.round(rate * 100)}%` }]} />
                    </View>
                    <Text style={styles.slotValue}>{percent(rate)}</Text>
                  </View>
                ))
              )}
              <Row label="Best slot" value={profile.bestSlot ? SLOT_LABEL[profile.bestSlot] : NONE} />
              <Row label="Best week" value={profile.bestWeek > 0 ? `${Math.round(profile.bestWeek)} pts` : NONE} />
            </View>
          </View>
        )}
      </Animated.ScrollView>
    </Screen>
  );
}

const CHART = { width: 300, height: 96, padding: 4 };

/** The clear-5/5 chance after each verified proof this week, held flat until the next one like a market price. */
function ClearChart({ points }: { points: { at: number; value: number }[] }) {
  const line = stepPath(points, CHART);
  return (
    <Svg width="100%" height={CHART.height} viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none" accessible={false}>
      <Path d={areaPath(line, CHART)} fill={colors.accent} fillOpacity={0.12} />
      <Path d={line.d} stroke={colors.accent} strokeWidth={2.5} fill="none" />
    </Svg>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  body: { paddingHorizontal: SCREEN_MARGIN, gap: spacing.md, paddingBottom: spacing.xl },
  card: { ...cardStyle, padding: spacing.lg, gap: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tile: { ...cardStyle, flexBasis: "47%", flexGrow: 1, padding: spacing.lg, gap: spacing.xs },
  tileValue: { fontFamily: fontFamily.bold, fontSize: font.score, color: colors.text, ...tabular },
  label: { ...type.small, color: colors.textMuted },
  bigRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.md },
  delta: { ...type.label, ...tabular },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  big: { fontFamily: fontFamily.extraBold, fontSize: font.score * 1.6, color: colors.accent, ...tabular },
  slotRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 32 },
  slotName: { ...type.small, color: colors.text, width: 76 },
  track: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.strip, overflow: "hidden" },
  fill: { height: 4, backgroundColor: colors.accent },
  slotValue: { ...type.small, color: colors.textMuted, width: 40, textAlign: "right", ...tabular },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 36 },
  rowLabel: { ...type.small, color: colors.textMuted },
  rowValue: { fontFamily: fontFamily.bold, fontSize: type.small.fontSize, color: colors.text, ...tabular },
});
