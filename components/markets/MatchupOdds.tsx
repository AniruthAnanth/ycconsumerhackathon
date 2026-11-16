import { StyleSheet, Text, View } from "react-native";

import { winBarSplit } from "@/components/social/matchup/matchupLogic";
import { Avatar } from "@/components/ui";
import { BORDER, colors, fontFamily, radius, spacing, tabular, type } from "@/theme";

type Side = { name: string; chance: number };

/** The two colours of the head-to-head, used by the tiles and the bar alike. */
export const ODDS_COLORS = { me: colors.green, them: colors.faint } as const;

/**
 * The head-to-head as a two-sided market framed as a question ("Will you beat Sam this week?"), the way a binary contract is shown: one tile per
 * outcome with its chance, then one split bar where each side's colour fills exactly its share.
 * The bar is two flex children sized by the shares themselves, so its proportions can't drift
 * from the numbers. `compact` drops the tiles for the Roster card.
 */
export function MatchupOdds({ me, them, compact = false }: { me: Side; them: Side; compact?: boolean }) {
  const { mineShare, minePercent, theirsPercent } = winBarSplit(me.chance, them.chance);
  return (
    <View
      style={styles.wrap}
      testID="matchup-odds"
      accessible
      accessibilityLabel={`Win this matchup: you ${minePercent}%, ${them.name} ${theirsPercent}%`}
    >
      {compact ? (
        <Text style={styles.caption}>Win this matchup</Text>
      ) : (
        <>
        <Text style={styles.question}>{`Will you beat ${them.name} this week?`}</Text>
        <View style={styles.tiles}>
          <Tile name="You" avatarName={me.name} percent={minePercent} color={ODDS_COLORS.me} />
          <Tile name={them.name} avatarName={them.name} percent={theirsPercent} color={colors.divider} />
        </View>
        </>
      )}
      <View style={styles.barRow}>
        <Text style={[styles.end, { color: ODDS_COLORS.me }]}>{`You ${minePercent}%`}</Text>
        <View style={styles.bar}>
          {mineShare > 0 ? <View style={{ flex: mineShare, backgroundColor: ODDS_COLORS.me }} /> : null}
          {mineShare < 1 ? <View style={{ flex: 1 - mineShare, backgroundColor: ODDS_COLORS.them }} /> : null}
        </View>
        <Text style={[styles.end, styles.endRight]} numberOfLines={1}>{`${them.name.split(" ")[0]} ${theirsPercent}%`}</Text>
      </View>
    </View>
  );
}

function Tile({ name, avatarName, percent, color }: { name: string; avatarName: string; percent: number; color: string }) {
  return (
    <View style={[styles.tile, { borderColor: color }]}>
      <View style={styles.tileHead}>
        <Avatar name={avatarName} size={28} />
        <Text style={styles.tileName} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Text style={styles.tilePercent}>{`${percent}%`}</Text>
      <Text style={styles.tileCaption}>chance to win</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  caption: { ...type.caption, color: colors.textMuted, letterSpacing: 0.6 },
  question: { ...type.subheading, color: colors.text },
  tiles: { flexDirection: "row", gap: spacing.md },
  tile: { flex: 1, padding: spacing.md, gap: 2, borderRadius: radius.control, borderWidth: BORDER * 2, backgroundColor: colors.surface },
  tileHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tileName: { ...type.label, color: colors.text, flex: 1 },
  tilePercent: { ...type.title, color: colors.text, ...tabular },
  tileCaption: { ...type.caption, color: colors.textMuted },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bar: { flex: 1, height: 12, flexDirection: "row", borderRadius: radius.pill, overflow: "hidden", gap: 2, backgroundColor: colors.surface },
  end: { minWidth: 64, maxWidth: 110, fontFamily: fontFamily.extraBold, fontSize: type.label.fontSize, ...tabular },
  endRight: { textAlign: "right", color: colors.textMuted },
});
