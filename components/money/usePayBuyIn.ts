import { useAction } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { notify } from "@/components/social/notify";
import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";
import { colors } from "@/theme";

type Checkout = { embedUrl: string; purchaseUrl: string };

/**
 * Paying a league's buy-in. An unpaid member plays fully but can't win the pot,
 * so the header's pay button is a nudge rather than a wall.
 *
 * Pay opens Whop's hosted checkout in the in-app browser (SFSafariViewController
 * on iOS) tinted our green. The checkout session is made as soon as the hook
 * mounts, so the browser opens at once. The button goes away when Whop's webhook
 * marks the membership paid; closing the browser proves nothing. That same flip is
 * what opens the post-pay sheet (PayButton), so this hook says nothing after it closes.
 */
export function usePayBuyIn(leagueId: Id<"leagues">) {
  const createCheckout = useAction(backend.whop.createCheckout);
  const [opening, setOpening] = useState(false);
  const [prepared, setPrepared] = useState<Checkout | null>(null);
  const preparing = useRef(false);
  useEffect(() => {
    if (preparing.current) return;
    preparing.current = true;
    createCheckout({ leagueId }).then(setPrepared, () => undefined);
  }, [createCheckout, leagueId]);

  async function pay() {
    if (opening) return;
    setOpening(true);
    // A browser only lets a tab open inside the tap that asked for it, and the checkout URL may arrive after
    // an await. So on the web the tab is opened first, blank, and pointed at Whop once the URL is here.
    const tab = Platform.OS === "web" ? window.open("", "_blank") : null;
    if (Platform.OS === "web" && !tab) {
      setOpening(false);
      notify("Checkout blocked", "Your browser blocked the checkout tab. Allow pop-ups, then tap again.");
      return;
    }
    let checkout: Checkout;
    try {
      checkout = prepared ?? (await createCheckout({ leagueId }));
    } catch {
      tab?.close();
      setOpening(false);
      notify("Checkout didn't open", "Tap the card to try again.");
      return;
    }
    setOpening(false);
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
  }

  return { pay, opening };
}
