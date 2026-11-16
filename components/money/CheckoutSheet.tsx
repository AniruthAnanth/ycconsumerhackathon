import { useQuery } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector, GestureHandlerRootView, usePanGesture } from "react-native-gesture-handler";
import Animated, { SlideInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ease, useReduceMotion } from "@/components/motion";
import { confirmAction } from "@/components/social/notify";
import { Header, Icon, SheetGrabber, sheetSurface } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { parseCheckoutMessage } from "@/convex/lib/checkoutPage";
import { backend } from "@/lib/backend";
import { formatUsd } from "@/lib/leagueText";
import { SHEET_MS } from "@/lib/native/motion";
import { shouldDismiss } from "@/lib/native/swipeDismiss";
import { colors, duration, font, fontFamily, MIN_TARGET, radius, SCREEN_MARGIN, spacing, spring } from "@/theme";

import { CheckoutFrame } from "./CheckoutFrame";

type Props = {
  leagueId: Id<"leagues">;
  stakeUsd: number;
  /** One checkout from whop.createCheckout, at both of its addresses. */
  checkout: { embedUrl: string; purchaseUrl: string };
  onClose: () => void;
};

/**
 * How long the embedded form gets to draw itself before Whop's hosted page takes over. On a phone
 * Whop's form has taken about 14 s to arrive, so a tighter limit would throw players out of a
 * checkout that was about to appear.
 */
const EMBED_TIMEOUT_MS = 30_000;
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
  // The footer gives its room to the form while the keyboard is up, so the card fields stay in view.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => setTyping(true));
    const hidden = Keyboard.addListener("keyboardDidHide", () => setTyping(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

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

  // Swiping the top of the sheet down closes it, as the grabber promises. The drag lives on the
  // grabber, header and summary only, so it never fights the checkout form's own scrolling. Once
  // Whop's form is up the player may be partway through paying, so a swipe asks first.
  const dragY = useSharedValue(0);
  const sheetHeight = useSharedValue(0);
  const confirmLeave = useCallback(() => {
    confirmAction({
      title: "Leave checkout?",
      message: "If you've already paid, Whop still counts it. Otherwise nothing is charged.",
      confirmLabel: "Leave",
      onConfirm: onClose,
    });
  }, [onClose]);
  const asksFirst = stage === "ready";
  const swipeDown = usePanGesture({
    activeOffsetY: 8,
    failOffsetX: [-24, 24],
    onUpdate: (event) => {
      dragY.value = Math.max(0, event.translationY);
    },
    onDeactivate: (event) => {
      if (!shouldDismiss(event.translationY, event.velocityY)) {
        dragY.value = withSpring(0, spring.snappy);
        return;
      }
      if (asksFirst) {
        dragY.value = withSpring(0, spring.snappy);
        scheduleOnRN(confirmLeave);
        return;
      }
      dragY.value = withTiming(sheetHeight.value, { duration: duration.base, easing: ease.standard }, () => scheduleOnRN(onClose));
    },
  });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  // An RN Modal rather than a native form sheet: a form sheet needs its own route, and checkout
  // opens over the screen that asked for it. The scrim fades while the sheet rises with the
  // shared sheet chrome (components/ui/Sheet) and the emphasized easing.
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* No KeyboardAvoidingView: the web view moves its own focused field above the keyboard, and
          shrinking the sheet under it as well left the form half a screen tall and sent taps on the
          card fields to the wrong field while it resized. */}
      {/* A Modal draws outside the app's GestureHandlerRootView on iOS, so the swipe-down on the
          grabber and header only works with a root of its own in here. */}
      <GestureHandlerRootView style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close checkout" />
        <Animated.View
          testID="checkout-sheet"
          entering={reduceMotion ? undefined : SlideInDown.duration(SHEET_MS).easing(ease.emphasized)}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }, dragStyle]}
          onLayout={(event) => {
            sheetHeight.value = event.nativeEvent.layout.height;
          }}
          accessibilityViewIsModal
        >
          <GestureDetector gesture={swipeDown}>
            <View>
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
            </View>
          </GestureDetector>

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
                <View style={styles.loading} accessibilityLabel="Loading secure checkout" accessibilityLiveRegion="polite">
                  <View style={[styles.bone, styles.boneLabel]} />
                  <View style={[styles.bone, styles.boneField]} />
                  <View style={[styles.bone, styles.boneLabel]} />
                  <View style={styles.boneCard}>
                    <View style={[styles.bone, styles.boneField]} />
                    <View style={styles.boneRow}>
                      <View style={[styles.bone, styles.boneField, styles.boneHalf]} />
                      <View style={[styles.bone, styles.boneField, styles.boneHalf]} />
                    </View>
                  </View>
                  <View style={[styles.bone, styles.boneField]} />
                  <View style={[styles.bone, styles.bonePay]} />
                  <View style={styles.loadingNote}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.muted}>Loading secure checkout · Whop</Text>
                  </View>
                </View>
              ) : null}
            </View>
          )}

          {stage === "paid" || typing ? null : (
            <View style={styles.footer}>
              <Text style={styles.caption}>Payments by Whop. Sandbox: no real money moves.</Text>
              <Pressable style={styles.link} onPress={openInBrowser} accessibilityRole="link">
                <Text style={styles.linkText}>Open in browser instead</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </GestureHandlerRootView>
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
    paddingHorizontal: SCREEN_MARGIN,
    paddingTop: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  // A still outline of Whop's card form, so the wait reads as a form arriving and not an empty sheet.
  bone: { borderRadius: radius.control, backgroundColor: colors.divider, opacity: 0.6 },
  boneLabel: { width: 72, height: 12, marginTop: spacing.sm },
  boneField: { height: 44 },
  boneCard: { gap: spacing.sm },
  boneRow: { flexDirection: "row", gap: spacing.sm },
  boneHalf: { flex: 1 },
  bonePay: { height: 48, marginTop: spacing.md, backgroundColor: colors.accent, opacity: 0.25 },
  loadingNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg },
  paid: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  tick: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.accent },
  paidTitle: { fontFamily: fontFamily.extraBold, fontSize: font.total, color: colors.text },
  footer: { alignItems: "center", paddingTop: spacing.sm },
  caption: { fontFamily: fontFamily.semiBold, fontSize: font.label, color: colors.textFaint },
  link: { minHeight: MIN_TARGET, justifyContent: "center", paddingHorizontal: spacing.lg },
  linkText: { fontFamily: fontFamily.bold, fontSize: font.meta, color: colors.accent },
});
