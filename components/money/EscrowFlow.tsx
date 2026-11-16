import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { CountUp, useReduceMotion } from "@/components/motion";
import { Avatar } from "@/components/ui";
import type { EscrowMember, EscrowPayout } from "@/lib/escrow";
import { formatUsd } from "@/lib/leagueText";
import { colors, font, fontFamily, money, radius, spacing } from "@/theme";

import { escrowLayout } from "./escrowLayout";
import { DROP_SHARE } from "./escrowTimeline";
import { FlowLane } from "./FlowLane";
import { useEscrowPlayback } from "./useEscrowPlayback";

export type { EscrowMember } from "@/lib/escrow";

export type EscrowFlowProps = {
  members: EscrowMember[];
  stakeUsd: number;
  potUsd: number;
  /**
   * The lower box, for example { label: "Winner takes up to", amountUsd: 110 } or
   * { label: "Paid out", amountUsd: 110 }. Leave amountUsd out when the label says it all ("No payout").
   */
  payout: EscrowPayout;
  /** A shorter layout for use inside a sheet. */
  compact?: boolean;
  testID?: string;
};

/** The ring around an avatar: solid green once the member has paid. */
const RING = 2;
/** The clear drop between the diagram and the payout box. */
const DROP = { regular: 28, compact: 18 } as const;
/** The pot figure is the biggest on the screen while it fits its box: "$240" does, "$36.50" does not. */
const POT_DIGITS_AT_FULL_SIZE = 4;

/**
 * The league's money as a picture: members down both sides, a curve from each into the pot in
 * the middle, and a line from the pot down to what the winner takes. Dollars fly along a paid
 * member's curve once, when the diagram first appears or when that member's buy-in lands; an
 * unpaid member is dimmed, with a dashed line and no dollars.
 */
export function EscrowFlow({ members, stakeUsd, potUsd, payout, compact = false, testID }: EscrowFlowProps) {
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const layout = escrowLayout(width, members.length, compact);
  const { plays, arrivedUsd, pulse, settle } = useEscrowPlayback({ members, stakeUsd, potUsd, ready: width > 0, reduceMotion });
  // The line leaves the pot's bottom edge. In a big league the columns of avatars are taller than
  // the pot, so it first runs down between them before it clears the diagram.
  const below = layout.height - (layout.pot.y + layout.pot.height);
  const drop = below + (compact ? DROP.compact : DROP.regular);

  const potStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.05 * pulse.value }] }));
  const dropStyle = useAnimatedStyle(() => ({ height: interpolate(settle.value, [0, DROP_SHARE], [0, drop], "clamp") }), [drop]);
  const payoutStyle = useAnimatedStyle(() => {
    const landed = interpolate(settle.value, [DROP_SHARE, 1], [0, 1], "clamp");
    const eased = 1 - Math.pow(1 - landed, 3);
    return { opacity: eased, transform: [{ translateY: -6 * (1 - eased) }, { scale: 0.94 + 0.06 * eased }] };
  });

  const potTotal = formatUsd(potUsd);
  const fullSize = !compact && potTotal.length <= POT_DIGITS_AT_FULL_SIZE;

  return (
    <View testID={testID} style={styles.root} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={[styles.flow, { height: layout.height }]}>
        {width > 0 ? (
          <>
            <Svg width={width} height={layout.height} style={StyleSheet.absoluteFill}>
              {members.map((member, index) => (
                // Keyed on paid too: react-native-svg keeps a strokeDasharray after the prop is removed,
                // so a member who pays mid-view would keep the unpaid dashed line until a remount.
                <Path
                  key={`${member.userId}-${member.paid ? "paid" : "unpaid"}`}
                  d={layout.lanes[index]!.path}
                  fill="none"
                  strokeLinecap="round"
                  stroke={member.paid ? colors.accent : colors.textFaint}
                  strokeOpacity={member.paid ? 0.35 : 0.6}
                  strokeWidth={member.paid ? 2 : 1.5}
                  {...(!member.paid && { strokeDasharray: "2 5" })}
                />
              ))}
            </Svg>
            {members.map((member, index) =>
              member.paid ? (
                <FlowLane key={member.userId} curve={layout.lanes[index]!.curve} play={plays[member.userId]} still={reduceMotion} />
              ) : null,
            )}
            {members.map((member, index) => (
              <MemberDot key={member.userId} member={member} size={layout.avatarSize} at={layout.lanes[index]!.avatar} />
            ))}
            {/* Drawn last, so a dollar slides under the pot's edge as it lands. */}
            <Animated.View
              style={[styles.pot, { left: layout.pot.x, top: layout.pot.y, width: layout.pot.width, height: layout.pot.height }, potStyle]}
            >
              <Text style={styles.potLabel}>POT</Text>
              <CountUp
                style={[styles.potTotal, fullSize ? styles.potTotalFull : styles.potTotalSmall]}
                numberOfLines={1}
                value={arrivedUsd}
                format={formatUsd}
                // Always the real total, so a screen reader never hears a figure mid-count.
                accessibilityLabel={`Pot ${potTotal}`}
              />
            </Animated.View>
          </>
        ) : null}
      </View>
      <View style={{ height: drop, marginTop: -below }}>
        <Animated.View style={[styles.drop, dropStyle]} />
      </View>
      <Animated.View
        testID={testID ? `${testID}-payout` : undefined}
        style={[styles.payout, compact && styles.payoutCompact, payoutStyle]}
        accessible
        accessibilityLabel={payout.amountUsd === undefined ? payout.label : `${payout.label} ${formatUsd(payout.amountUsd)}`}
      >
        <Text style={styles.payoutLabel}>{payout.label}</Text>
        {payout.amountUsd === undefined ? null : (
          <CountUp style={styles.payoutAmount} value={payout.amountUsd} format={formatUsd} />
        )}
      </Animated.View>
    </View>
  );
}

function MemberDot({ member, size, at }: { member: EscrowMember; size: number; at: { x: number; y: number } }) {
  return (
    <View
      accessible
      accessibilityLabel={`${member.name}, ${member.paid ? "paid" : "unpaid"}`}
      style={[
        styles.member,
        { left: at.x, top: at.y, width: size, height: size, borderRadius: size / 2 },
        member.paid ? styles.memberPaid : styles.memberUnpaid,
      ]}
    >
      <Avatar name={member.name} size={size - 2 * RING - 2} {...(member.avatarUrl !== undefined && { uri: member.avatarUrl })} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Capped, so on a tablet or the web the lines stay short curves instead of long flat runs.
  root: { width: "100%", maxWidth: 420, alignSelf: "center", alignItems: "center" },
  // Full width: the avatars, curves and pot inside are placed in the root's coordinates.
  flow: { alignSelf: "stretch" },
  member: { position: "absolute", alignItems: "center", justifyContent: "center", borderWidth: RING, backgroundColor: colors.surface },
  memberPaid: { borderColor: colors.accent },
  memberUnpaid: { borderColor: colors.textFaint, borderStyle: "dashed", opacity: 0.45 },
  pot: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.card,
    backgroundColor: colors.accent,
  },
  potLabel: { fontSize: font.label, fontFamily: fontFamily.bold, color: money.tint, letterSpacing: 0.6 },
  potTotal: { fontFamily: fontFamily.extraBold, color: colors.onAccent, fontVariant: ["tabular-nums"] },
  potTotalFull: { fontSize: font.pot, lineHeight: font.pot + 4 },
  potTotalSmall: { fontSize: font.total, lineHeight: font.total + 4 },
  drop: { width: 2, borderRadius: 1, backgroundColor: colors.accent },
  payout: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.lime,
  },
  payoutCompact: { paddingVertical: spacing.sm },
  payoutLabel: { fontFamily: fontFamily.semiBold, fontSize: font.body, color: colors.text },
  payoutAmount: { fontFamily: fontFamily.extraBold, fontSize: font.score, color: money.text, fontVariant: ["tabular-nums"] },
});
