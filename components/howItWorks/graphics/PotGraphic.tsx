import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useReduceMotion } from "@/components/motion";
import { EscrowFlow } from "@/components/money/EscrowFlow";
import { escrowTimeline } from "@/components/money/escrowTimeline";
import { Avatar } from "@/components/ui";
import type { EscrowMember } from "@/lib/escrow";
import { formatUsd } from "@/lib/leagueText";
import { colors, duration, radius, spacing, type } from "@/theme";

import { useBeat } from "./useBeat";

const STAKE_USD = 20;
const NAMES = ["You", "Maya", "Dev", "Sam", "Priya", "Leo"];
const POT_USD = STAKE_USD * NAMES.length;
const MEMBERS: EscrowMember[] = NAMES.map((name) => ({ userId: name, name, paid: true }));
/** The members tied for the most slots cleared this week: they split the pot evenly. */
const TOP = NAMES.slice(0, 3);
const SHARE_USD = POT_USD / TOP.length;
/** The shares land once the pot has filled and its line has dropped to the split box. */
const SPLIT_AT = escrowTimeline(NAMES.length).endsAt;

/** One top member's even share, landing in their escrow balance. */
function Share({ playing, index, name }: { playing: boolean; index: number; name: string }) {
  const beat = useBeat(playing, { delay: SPLIT_AT + duration.fast * index, length: duration.slow });
  const style = useAnimatedStyle(() => ({ opacity: beat.value, transform: [{ translateY: (1 - beat.value) * -12 }] }));
  return (
    <Animated.View style={[styles.share, style]} accessible accessibilityLabel={`${name}, ${formatUsd(SHARE_USD)} in escrow`}>
      <View style={styles.shareTop}>
        <Avatar name={name} size={20} />
        <Text style={styles.amount}>{formatUsd(SHARE_USD)}</Text>
      </View>
      <Text style={styles.escrow}>In escrow</Text>
    </Animated.View>
  );
}

/**
 * "Win the pot": six paid members send their buy-ins into the pot, the pot counts up to its total,
 * then it splits evenly into the escrow balances of the three members tied for the most slots
 * cleared. Everything replays each time the card comes into view.
 */
export function PotGraphic({ playing }: { playing: boolean }) {
  const reduceMotion = useReduceMotion();
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (playing && !reduceMotion) setRun((current) => current + 1);
  }, [playing, reduceMotion]);

  return (
    <View style={styles.root}>
      <EscrowFlow key={run} compact members={MEMBERS} stakeUsd={STAKE_USD} potUsd={POT_USD} payout={{ label: `Split ${TOP.length} ways` }} />
      <View style={styles.shares}>
        {TOP.map((name, index) => (
          <Share key={name} playing={playing} index={index} name={name} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: 260, width: "100%", justifyContent: "center", gap: spacing.sm },
  shares: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  share: { alignItems: "center", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.control, backgroundColor: colors.greenSoft },
  shareTop: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  amount: { ...type.label, color: colors.accent },
  escrow: { ...type.caption, color: colors.textMuted },
});
