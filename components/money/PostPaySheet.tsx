import * as Clipboard from "expo-clipboard";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Easing, SlideInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useInviteLink, useShareInvite } from "@/components/invite/useShareInvite";
import { useReduceMotion } from "@/components/motion";
import { Button, SheetGrabber, sheetSurface } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";
import { formatUsd } from "@/lib/leagueText";
import { haptics } from "@/lib/native/haptics";
import { SHEET_MS } from "@/lib/native/motion";
import { colors, font, fontFamily, MIN_TARGET, radius, SCREEN_MARGIN, spacing, tabular } from "@/theme";

/** Coins that drop into the pot, one after another. */
const COINS = 3;
const COIN_DROP_MS = 420;
const COIN_GAP_MS = 140;

type Props = { leagueId: Id<"leagues">; stakeUsd: number; onClose: () => void };

/**
 * The moment after a buy-in lands, which the header's pay button hands over to once Whop's
 * webhook marks the player paid. It celebrates (coins drop into the pot, a success haptic) and
 * then asks for the one thing that makes the pot bigger: friends. Every friend who joins and
 * pays adds a stake, so the preview shows the pot now and with one more.
 */
export function PostPaySheet({ leagueId, stakeUsd, onClose }: Props) {
  const pot = useQuery(backend.standings.pot, { leagueId });
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { share, busy, notice } = useShareInvite(leagueId);
  const inviteLink = useInviteLink();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    haptics.success();
  }, []);

  async function copyLink() {
    haptics.tap();
    await Clipboard.setStringAsync(await inviteLink(leagueId));
    setCopied(true);
  }

  const potUsd = pot?.potUsd ?? stakeUsd;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <Animated.View
          testID="post-pay-sheet"
          entering={reduceMotion ? undefined : SlideInDown.duration(SHEET_MS)}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          accessibilityViewIsModal
        >
          <SheetGrabber />
          <View style={styles.hero}>
            <View style={styles.coins} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {Array.from({ length: COINS }, (_, i) => (
                <Coin key={i} index={i} still={reduceMotion} />
              ))}
            </View>
            <Text style={styles.title} accessibilityRole="header">
              You're in.
            </Text>
            <Text style={styles.pot}>{`Pot: ${formatUsd(potUsd)}`}</Text>
          </View>

          <View style={styles.push}>
            <Text style={styles.pushTitle}>{`Every friend who joins adds ${formatUsd(stakeUsd)} to the pot`}</Text>
            <View style={styles.preview} accessible accessibilityLabel={`Pot ${formatUsd(potUsd)} now, ${formatUsd(potUsd + stakeUsd)} with one more friend`}>
              <Text style={styles.previewNow}>{formatUsd(potUsd)}</Text>
              <Text style={styles.previewArrow}>{"\u2192"}</Text>
              <Text style={styles.previewNext}>{formatUsd(potUsd + stakeUsd)}</Text>
              <Text style={styles.previewNote}>with one more</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Button label={notice ?? "Invite friends"} onPress={() => void share()} loading={busy} haptic="none" />
            <Pressable style={styles.secondary} onPress={() => void copyLink()} accessibilityRole="button" testID="post-pay-copy">
              <Text style={styles.secondaryText}>{copied ? "Link copied" : "Copy link"}</Text>
            </Pressable>
            <Pressable style={styles.quiet} onPress={onClose} accessibilityRole="button" testID="post-pay-later">
              <Text style={styles.quietText}>Later</Text>
            </Pressable>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** One coin falling into place and settling, a beat after the one before it. */
function Coin({ index, still }: { index: number; still: boolean }) {
  const drop = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    drop.value = withDelay(SHEET_MS + index * COIN_GAP_MS, withTiming(1, { duration: COIN_DROP_MS, easing: Easing.bounce }));
  }, [drop, index, still]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, drop.value * 3),
    transform: [{ translateY: (1 - drop.value) * -90 }],
  }));
  return (
    <Animated.View style={[styles.coin, { marginLeft: index === 0 ? 0 : -10, zIndex: COINS - index }, style]}>
      <Text style={styles.coinMark}>$</Text>
    </Animated.View>
  );
}

const COIN = 40;

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end", alignItems: "center", backgroundColor: colors.scrim },
  sheet: { width: "100%", maxWidth: 520, paddingHorizontal: SCREEN_MARGIN, gap: spacing.lg, ...sheetSurface },
  hero: { alignItems: "center", gap: spacing.xs, paddingTop: spacing.md },
  coins: { flexDirection: "row", height: COIN + spacing.sm, alignItems: "flex-end", marginBottom: spacing.sm },
  coin: {
    width: COIN,
    height: COIN,
    borderRadius: COIN / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  coinMark: { fontFamily: fontFamily.extraBold, fontSize: font.body, color: colors.accent },
  title: { fontFamily: fontFamily.extraBold, fontSize: font.total, color: colors.text },
  pot: { fontFamily: fontFamily.bold, fontSize: font.score, color: colors.accent, ...tabular },
  push: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.card, backgroundColor: colors.surface },
  pushTitle: { fontFamily: fontFamily.bold, fontSize: font.body, color: colors.text },
  preview: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  previewNow: { fontFamily: fontFamily.bold, fontSize: font.score, color: colors.textMuted, ...tabular },
  previewArrow: { fontFamily: fontFamily.bold, fontSize: font.score, color: colors.textMuted },
  previewNext: { fontFamily: fontFamily.extraBold, fontSize: font.score, color: colors.accent, ...tabular },
  previewNote: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  actions: { gap: spacing.xs },
  secondary: { minHeight: MIN_TARGET, alignItems: "center", justifyContent: "center", borderRadius: radius.control, borderWidth: 1, borderColor: colors.accent },
  secondaryText: { fontFamily: fontFamily.bold, fontSize: font.body, color: colors.accent },
  quiet: { minHeight: MIN_TARGET, alignItems: "center", justifyContent: "center" },
  quietText: { fontFamily: fontFamily.semiBold, fontSize: font.meta, color: colors.textMuted },
});
