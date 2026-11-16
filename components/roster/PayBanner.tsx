import { useAction, useConvex } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { notify } from "@/components/social/notify";
import { Banner } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";
import { colors } from "@/theme";

type Props = { leagueId: Id<"leagues">; stakeUsd: number };

type Checkout = { embedUrl: string; purchaseUrl: string };

/** How long after the browser closes to look again for Whop's webhook, which can trail the payment. */
const WEBHOOK_GRACE_MS = 2_500;

/**
 * Shown on Roster until the buy-in is paid. An unpaid member plays fully but
 * can't win the pot, so this is a nudge rather than a wall.
 *
 * Pay opens Whop's hosted checkout in the in-app browser (SFSafariViewController
 * on iOS) tinted our green. The checkout session is made as soon as the banner
 * shows, so the browser opens at once. The banner goes away when Whop's webhook
 * marks the membership paid; closing the browser proves nothing, so the app only
 * says "You're in" when the webhook has already landed, and otherwise says nothing.
 */
export function PayBanner({ leagueId, stakeUsd }: Props) {
  const convex = useConvex();
  const createCheckout = useAction(backend.whop.createCheckout);
  const [state, setState] = useState<"idle" | "opening" | "failed" | "blocked">("idle");
  const [prepared, setPrepared] = useState<Checkout | null>(null);
  const preparing = useRef(false);
  useEffect(() => {
    if (preparing.current) return;
    preparing.current = true;
    createCheckout({ leagueId }).then(setPrepared, () => undefined);
  }, [createCheckout, leagueId]);

  async function isPaid(): Promise<boolean> {
    const me = await convex.query(backend.users.me, {});
    return me?.leagues.some((league) => league._id === leagueId && league.paid) ?? false;
  }

  async function pay() {
    setState("opening");
    // A browser only lets a tab open inside the tap that asked for it, and the checkout URL may arrive after
    // an await. So on the web the tab is opened first, blank, and pointed at Whop once the URL is here.
    const tab = Platform.OS === "web" ? window.open("", "_blank") : null;
    if (Platform.OS === "web" && !tab) {
      setState("blocked");
      return;
    }
    let checkout: Checkout;
    try {
      checkout = prepared ?? (await createCheckout({ leagueId }));
    } catch {
      tab?.close();
      setState("failed");
      return;
    }
    setState("idle");
    if (tab) {
      tab.location.href = checkout.purchaseUrl;
      return;
    }
    await WebBrowser.openBrowserAsync(checkout.purchaseUrl, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: colors.accent,
      toolbarColor: colors.background,
      dismissButtonStyle: "cancel",
    });
    if (!(await isPaid())) {
      await new Promise((resolve) => setTimeout(resolve, WEBHOOK_GRACE_MS));
      if (!(await isPaid())) return;
    }
    notify("You're in", "Your buy-in is in the pot.");
  }

  return (
    <Banner
      icon="card-outline"
      title={`Pay your $${stakeUsd} buy-in`}
      subtitle={SUBTITLE[state]}
      onPress={state === "opening" ? undefined : pay}
    />
  );
}

const SUBTITLE = {
  idle: undefined,
  opening: "Opening checkout...",
  failed: "Checkout didn't open. Tap to try again.",
  blocked: "Your browser blocked the checkout tab. Allow pop-ups, then tap to try again.",
} as const;
