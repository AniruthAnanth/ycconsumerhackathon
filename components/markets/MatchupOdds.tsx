import { StyleSheet, Text, View } from "react-native";

import { winBarSplit } from "@/components/social/matchup/matchupLogic";
import { Avatar } from "@/components/ui";
import { colors, fontFamily, radius, spacing, tabular, type } from "@/theme";

type Side = { name: string; chance: number };

/** The two colours of the head-to-head: our green for you, a neutral for the opponent. */
export const ODDS_COLORS = { me: colors.green, them: colors.textMuted } as const;

/**
 * The head-to-head as one two-sided market row: your avatar and chance, a split bar, then the
 * opponent's chance and avatar, with each number shown once. The bar is two flex children sized by
 * the shares themselves, so its proportions can't drift from the numbers. `compact` drops the
 * question line for the Roster card.
 */
export function MatchupOdds({ me, them, compact = false }: { me: Side; them: Side; compact?: boolean }) {
  const { mineShare, minePercent, theirsPercent } = winBarSplit(me.chance, them.chance);
  // A sliver under 2% draws as a stray glyph on the rounded end, so the bar shows it as all theirs (the number still says 1%).
  const shown = mineShare < 0.02 ? 0 : mineShare > 0.98 ? 1 : mineShare;
  return (
    <View
      style={styles.wrap}
      testID="matchup-odds"
      accessible
      accessibilityLabel={`Chance to win this matchup: you ${minePercent}%, ${them.name} ${theirsPercent}%`}
    >
      {compact ? null : <Text style={styles.question}>{`Will you beat ${them.name} this week?`}</Text>}
      <View style={styles.row}>
        <View style={styles.side}>
          <Avatar name={me.name} size={24} />
          <Text style={[styles.figure, { color: ODDS_COLORS.me }]}>{`You ${minePercent}%`}</Text>
        </View>
        <View style={styles.bar}>
          {shown > 0 ? <View style={{ flex: shown, backgroundColor: ODDS_COLORS.me }} /> : null}
          {shown < 1 ? <View style={{ flex: 1 - shown, backgroundColor: ODDS_COLORS.them }} /> : null}
        </View>
        <View style={[styles.side, styles.sideEnd]}>
          <Text style={[styles.figure, styles.theirs]} numberOfLines={1} ellipsizeMode="tail">{`${theirsPercent}% ${them.name}`}</Text>
          <Avatar name={them.name} size={24} />
        </View>
      </View>
      <Text style={styles.caption}>chance to win this matchup</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  question: { ...type.subheading, color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  side: { flexDirection: "row", alignItems: "center", gap: spacing.xs, maxWidth: "42%", flexShrink: 1 },
  sideEnd: { justifyContent: "flex-end" },
  figure: { fontFamily: fontFamily.extraBold, fontSize: type.label.fontSize, ...tabular },
  theirs: { color: colors.textMuted, flexShrink: 1 },
  bar: { flex: 1, minWidth: 48, height: 12, flexDirection: "row", borderRadius: radius.pill, overflow: "hidden", gap: 2 },
  caption: { ...type.caption, color: colors.textMuted, textAlign: "center" },
});
