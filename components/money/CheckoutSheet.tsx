import { useQuery } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ease, useReduceMotion } from "@/components/motion";
import { Header, Icon, SheetGrabber, sheetSurface } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { parseCheckoutMessage } from "@/convex/lib/checkoutPage";
import { backend } from "@/lib/backend";
import { formatUsd } from "@/lib/leagueText";
import { SHEET_MS } from "@/lib/native/motion";
import { colors, font, fontFamily, MIN_TARGET, radius, SCREEN_MARGIN, spacing } from "@/theme";

import { CheckoutFrame } from "./CheckoutFrame";

type Props = {
  leagueId: Id<"leagues">;
  stakeUsd: number;
  /** One checkout from whop.createCheckout, at both of its addresses. */
  checkout: { embedUrl: string; purchaseUrl: string };
  onClose: () => void;
};

/** How long the embedded form gets to draw itself before Whop's hosted page takes over. */
const EMBED_TIMEOUT_MS = 15_000;
/** How long "You're in" stays up before the sheet closes itself. */
const PAID_HOLD_MS = 1_800;

/**
 * The buy-in as a sheet of our own: the league, the stake and the pot on top, Whop's checkout
 * form below, inside a web view.
 *
 * The sheet only shows what the checkout page reports. It closes after "complete", but the Pay
 * banner behind it goes away when Whop's webhook marks the member paid, never because of anything
 * that happens in here.
 *
 * Whop's hosted page in the in-app browser, which is what Pay used to open, stays as the way out:
 * the sheet hands over to it when the form fails to load or takes too long, and the player can
 * pick it from the footer.
 */
export function CheckoutSheet({ leagueId, stakeUsd, checkout, onClose }: Props) {
  const league = useQuery(backend.leagues.get, { leagueId });
  const pot = useQuery(backend.standings.pot, { leagueId });
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [stage, setStage] = useState<"loading" | "ready" | "paid">("loading");
  // Bumped to mount a fresh checkout after one came back from the bank without a payment.
  const [attempt, setAttempt] = useState(0);

  const openInBrowser = useCallback(() => {
    onClose();
    void WebBrowser.openBrowserAsync(checkout.purchaseUrl);
  }, [onClose, checkout.purchaseUrl]);

  const onMessage = useCallback(
    (data: unknown) => {
      const message = parseCheckoutMessage(data);
      if (message === "ready") setStage((current) => (current === "loading" ? "ready" : current));
      if (message === "complete") setStage("paid");
      if (message === "failed") openInBrowser();
      if (message === "returned") {
        setStage("loading");
        setAttempt((count) => count + 1);
      }
    },
    [openInBrowser],
  );

  useEffect(() => {
    if (stage === "ready") return;
    const timer = setTimeout(stage === "paid" ? onClose : openInBrowser, stage === "paid" ? PAID_HOLD_MS : EMBED_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [stage, attempt, onClose, openInBrowser]);

  // An RN Modal rather than a native form sheet: a form sheet needs its own route, and checkout
  // opens over the screen that asked for it. The scrim fades while the sheet rises with the
  // shared sheet chrome (components/ui/Sheet) and the emphasized easing.
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.scrim} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close checkout" />
        <Animated.View
          testID="checkout-sheet"
          entering={reduceMotion ? undefined : SlideInDown.duration(SHEET_MS).easing(ease.emphasized)}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          accessibilityViewIsModal
        >
          <SheetGrabber />
          <Header title="Lineup" onClose={onClose} />

          <View style={styles.summary}>
            <View style={styles.league}>
              <Text style={styles.label}>BUY-IN</Text>
              <Text style={styles.leagueName} numberOfLines={1}>
                {league?.name ?? " "}
              </Text>
              <Text style={styles.muted}>{pot ? `Pot ${formatUsd(pot.potUsd)} · ${pot.paid.length} paid` : " "}</Text>
            </View>
            <Text style={styles.amount} accessibilityLabel={`Buy-in ${formatUsd(stakeUsd)}`}>
              {formatUsd(stakeUsd)}
            </Text>
          </View>

          {stage === "paid" ? (
            <View style={styles.paid} accessibilityLiveRegion="polite">
              <View style={styles.tick}>
                <Icon name="checkmark" size={32} color={colors.onAccent} />
              </View>
              <Text style={styles.paidTitle}>You're in</Text>
              <Text style={styles.muted}>{`${formatUsd(stakeUsd)} is on its way into the pot.`}</Text>
            </View>
          ) : (
            <View style={styles.form}>
              <CheckoutFrame key={attempt} url={checkout.embedUrl} onMessage={onMessage} onError={openInBrowser} />
              {stage === "loading" ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.muted}>Loading secure checkout</Text>
                </View>
              ) : null}
            </View>
          )}

          {stage === "paid" ? null : (
            <View style={styles.footer}>
              <Text style={styles.caption}>Payments by Whop. Sandbox: no real money moves.</Text>
              <Pressable style={styles.link} onPress={openInBrowser} accessibilityRole="link">
                <Text style={styles.linkText}>Open in browser instead</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end", alignItems: "center", backgroundColor: colors.scrim },
  sheet: {
    width: "100%",
    maxWidth: 520,
    height: "92%",
    ...sheetSurface,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: SCREEN_MARGIN,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  league: { flex: 1, gap: spacing.xs },
  label: { fontFamily: fontFamily.bold, fontSize: font.label, color: colors.textMuted, letterSpacing: 0.6 },
  leagueName: { fontFamily: fontFamily.bold, fontSize: font.score, color: colors.text },
  muted: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  amount: { fontFamily: fontFamily.extraBold, fontSize: font.total, color: colors.text, fontVariant: ["tabular-nums"] },
  form: { flex: 1, marginTop: spacing.md },
  loading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  paid: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  tick: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.accent },
  paidTitle: { fontFamily: fontFamily.extraBold, fontSize: font.total, color: colors.text },
  footer: { alignItems: "center", paddingTop: spacing.sm },
  caption: { fontFamily: fontFamily.semiBold, fontSize: font.label, color: colors.textFaint },
  link: { minHeight: MIN_TARGET, justifyContent: "center", paddingHorizontal: spacing.lg },
  linkText: { fontFamily: fontFamily.bold, fontSize: font.meta, color: colors.accent },
});
