import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatScore } from "@/components/ui";
import { colors, font, fontFamily, hairline, MIN_TARGET, radius, SCREEN_MARGIN, spacing, tabular } from "@/theme";

import type { Bracket, BracketMatch, BracketRound, BracketSide } from "./types";

type Props = {
  bracket: Bracket;
  meId: string;
  onPlayerPress?: (userId: string) => void;
};

const LINE_HEIGHT = 28;
const MATCH_HEIGHT = LINE_HEIGHT * 2 + hairline * 3;
const MATCH_GAP = spacing.md;
const COLUMN_WIDTH = 168;
const CONNECTOR_WIDTH = spacing.lg;

/**
 * Every slot in round r is twice as tall as in round r-1, and a match is centred in its slot.
 * That alone puts match i of round r exactly between matches 2i and 2i+1 of round r-1.
 */
function slotHeight(roundIndex: number): number {
  return (MATCH_HEIGHT + MATCH_GAP) * 2 ** roundIndex;
}

/** The playoff tree: one column per round, scrolling sideways so two rounds fit on a phone. */
export function SeasonBracket({ bracket, meId, onPlayerPress }: Props) {
  const { rounds, championId, projected } = bracket;
  const lastRoundIndex = rounds.length - 1;
  const champion = findChampion(rounds, championId);

  return (
    <View>
      {projected ? <Text style={styles.projected}>PROJECTED</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
        {rounds.map((round, roundIndex) => (
          <View key={round.name} style={styles.column}>
            <Text style={styles.columnLabel} numberOfLines={1}>
              {(round.name + " · Week " + round.week).toUpperCase()}
            </Text>
            {round.matches.map((match, matchIndex) => (
              <Slot
                key={matchIndex}
                height={slotHeight(roundIndex)}
                connector={roundIndex < lastRoundIndex ? (matchIndex % 2 === 0 ? "first" : "second") : null}
              >
                <MatchBox match={match} meId={meId} onPlayerPress={onPlayerPress} />
              </Slot>
            ))}
          </View>
        ))}
        {champion ? (
          <View style={styles.championColumn}>
            <Text style={styles.columnLabel}>CHAMPION</Text>
            <View style={[styles.championSlot, { height: slotHeight(lastRoundIndex) }]}>
              <Pressable disabled={!onPlayerPress} onPress={() => onPlayerPress?.(champion.userId)}>
                <Text style={[styles.championName, champion.userId === meId && styles.me]}>
                  {champion.name}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function findChampion(rounds: BracketRound[], championId: string | null): BracketSide | null {
  if (!championId) return null;
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.a?.userId === championId) return match.a;
      if (match.b?.userId === championId) return match.b;
    }
  }
  return null;
}

type SlotProps = {
  height: number;
  /** Which half of a feeder pair this slot is, so the pair is joined by one elbow; null in the last round. */
  connector: "first" | "second" | null;
  children: React.ReactNode;
};

function Slot({ height, connector, children }: SlotProps) {
  const middle = height / 2;
  return (
    <View style={[styles.slot, { height }]}>
      <View style={styles.matchCell}>{children}</View>
      {connector ? (
        <View style={styles.connector}>
          <View style={[styles.line, { left: 0, width: CONNECTOR_WIDTH / 2, top: middle, height: hairline }]} />
          <View
            style={[
              styles.line,
              { left: CONNECTOR_WIDTH / 2, width: hairline },
              connector === "first" ? { top: middle, bottom: 0 } : { top: 0, height: middle },
            ]}
          />
          {connector === "first" ? (
            <View
              style={[styles.line, { left: CONNECTOR_WIDTH / 2, right: 0, top: height - hairline, height: hairline }]}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

type MatchBoxProps = { match: BracketMatch; meId: string; onPlayerPress?: (userId: string) => void };

function MatchBox({ match, meId, onPlayerPress }: MatchBoxProps) {
  const decided = match.winnerId != null;
  return (
    <View style={styles.match}>
      <SideLine
        side={match.a}
        score={match.scoreA}
        status={sideStatus(match.a, match.winnerId, decided)}
        hasScore={!match.bye}
        meId={meId}
        onPlayerPress={onPlayerPress}
      />
      <View style={styles.matchDivider} />
      {match.bye ? (
        <View style={styles.line28}>
          <Text style={styles.placeholder}>BYE</Text>
        </View>
      ) : (
        <SideLine
          side={match.b}
          score={match.scoreB}
          status={sideStatus(match.b, match.winnerId, decided)}
          hasScore
          meId={meId}
          onPlayerPress={onPlayerPress}
        />
      )}
    </View>
  );
}

type SideStatus = "winner" | "loser" | "open";

function sideStatus(side: BracketSide | null, winnerId: string | null, decided: boolean): SideStatus {
  if (!decided || !side) return "open";
  return side.userId === winnerId ? "winner" : "loser";
}

type SideLineProps = {
  side: BracketSide | null;
  score: number | null;
  status: SideStatus;
  /** False on a first-round bye, where there is nothing to score. */
  hasScore: boolean;
  meId: string;
  onPlayerPress?: (userId: string) => void;
};

function SideLine({ side, score, status, hasScore, meId, onPlayerPress }: SideLineProps) {
  if (!side) {
    return (
      <View style={styles.line28}>
        <Text style={styles.placeholder}>TBD</Text>
      </View>
    );
  }
  const muted = status === "loser";
  return (
    <Pressable
      style={styles.line28}
      hitSlop={spacing.sm}
      disabled={!onPlayerPress}
      onPress={() => onPlayerPress?.(side.userId)}
      accessibilityRole="button"
      accessibilityLabel={side.name}
    >
      <Text style={styles.seed}>{side.seed}</Text>
      <Text
        style={[
          styles.name,
          status === "winner" && styles.winnerName,
          muted && styles.mutedText,
          side.userId === meId && styles.me,
        ]}
        numberOfLines={1}
      >
        {side.name}
      </Text>
      {hasScore ? (
        <Text style={[styles.score, score == null ? styles.unscored : muted && styles.mutedText]}>
          {formatScore(score)}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  projected: {
    paddingHorizontal: SCREEN_MARGIN,
    paddingTop: spacing.md,
    fontSize: font.label,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  content: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: spacing.lg },
  column: { width: COLUMN_WIDTH + CONNECTOR_WIDTH },
  columnLabel: {
    height: 36,
    lineHeight: 36,
    paddingRight: CONNECTOR_WIDTH,
    fontSize: font.label,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  slot: { flexDirection: "row" },
  matchCell: { width: COLUMN_WIDTH, justifyContent: "center" },
  connector: { width: CONNECTOR_WIDTH },
  line: { position: "absolute", backgroundColor: colors.divider },
  match: {
    height: MATCH_HEIGHT,
    borderWidth: hairline,
    borderColor: colors.divider,
    borderRadius: radius.control,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  matchDivider: { height: hairline, backgroundColor: colors.divider },
  line28: {
    height: LINE_HEIGHT,
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: spacing.sm,
  },
  seed: {
    width: spacing.lg,
    fontFamily: fontFamily.regular, fontSize: font.label,
    color: colors.textMuted,
    ...tabular,
  },
  name: { flex: 1, fontFamily: fontFamily.regular, fontSize: font.body, color: colors.text },
  winnerName: { fontFamily: fontFamily.bold },
  mutedText: { color: colors.textMuted },
  me: { color: colors.accent },
  score: {
    minWidth: MIN_TARGET,
    textAlign: "right",
    fontSize: font.body,
    fontFamily: fontFamily.bold,
    color: colors.text,
    ...tabular,
  },
  unscored: { color: colors.textFaint },
  placeholder: { fontSize: font.meta, fontFamily: fontFamily.semiBold, letterSpacing: 0.6, color: colors.textFaint },
  championColumn: { width: COLUMN_WIDTH - CONNECTOR_WIDTH },
  championSlot: { justifyContent: "center" },
  championName: { fontSize: font.header, fontFamily: fontFamily.extraBold, color: colors.text },
});
