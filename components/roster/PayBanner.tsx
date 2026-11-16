import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { CheckoutFrame } from "@/components/money/CheckoutFrame";
import { CheckoutSheet } from "@/components/money/CheckoutSheet";
import { Banner } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";

type Props = { leagueId: Id<"leagues">; stakeUsd: number };

/**
 * Shown on Roster until the buy-in is paid. An unpaid member plays fully but
 * can't win the pot, so this is a nudge rather than a wall.
 *
 * It opens the buy-in in a sheet of our own with Whop's checkout form inside
 * (CheckoutSheet). The banner goes away when Whop's webhook marks the
 * membership paid and users.me() updates, never because the sheet closed:
 * closing it proves nothing.
 */
export function PayBanner({ leagueId, stakeUsd }: Props) {
  const createCheckout = useAction(backend.whop.createCheckout);
  const [state, setState] = useState<"idle" | "opening" | "failed" | "blocked">("idle");
  const [checkout, setCheckout] = useState<{ embedUrl: string; purchaseUrl: string } | null>(null);
  // Made as soon as the banner shows, so Pay doesn't wait on Whop for a checkout session.
  const [prepared, setPrepared] = useState<{ embedUrl: string; purchaseUrl: string } | null>(null);
  const preparing = useRef(false);
  useEffect(() => {
    if (preparing.current) return;
    preparing.current = true;
    createCheckout({ leagueId }).then(setPrepared, () => undefined);
  }, [createCheckout, leagueId]);

  async function pay() {
    setState("opening");
    // A browser only lets a tab open inside the tap that asked for it, and the checkout URL arrives after
    // an await. So on the web the tab is opened first, blank, and pointed at Whop once the URL is here.
    // The embedded sheet is native only: Whop's page can't be framed by every browser, and the sheet's
    // fallback to the hosted page ran outside a tap, so the browser dropped it without a word.
    const tab = Platform.OS === "web" ? window.open("", "_blank") : null;
    if (Platform.OS === "web" && !tab) {
      setState("blocked");
      return;
    }
    try {
      const created = prepared ?? (await createCheckout({ leagueId }));
      if (tab) {
        tab.location.href = created.purchaseUrl;
      } else {
        setCheckout(created);
      }
      setState("idle");
    } catch {
      tab?.close();
      setState("failed");
    }
  }

  return (
    <>
      <Banner
        icon="card-outline"
        title={`Pay your $${stakeUsd} buy-in`}
        subtitle={SUBTITLE[state]}
        onPress={state === "opening" ? undefined : pay}
      />
      {/* A hidden copy of the checkout page loads while the player reads the screen, so Whop's
          scripts and card fields are already cached when the sheet opens hers. Native only: on the
          web Pay opens Whop in a tab. */}
      {Platform.OS !== "web" && prepared && !checkout ? (
        <View style={styles.prewarm} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <CheckoutFrame url={prepared.embedUrl} onMessage={() => undefined} onError={() => undefined} />
        </View>
      ) : null}
      {checkout ? (
        <CheckoutSheet leagueId={leagueId} stakeUsd={stakeUsd} checkout={checkout} onClose={() => setCheckout(null)} />
      ) : null}
    </>
  );
}

const SUBTITLE = {
  idle: undefined,
  opening: "Opening checkout...",
  failed: "Checkout didn't open. Tap to try again.",
  blocked: "Your browser blocked the checkout tab. Allow pop-ups, then tap to try again.",
} as const;

const styles = StyleSheet.create({
  prewarm: { position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" },
});
