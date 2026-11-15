import { useAction } from "convex/react";
import { useState } from "react";
import { Platform } from "react-native";

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
      const created = await createCheckout({ leagueId });
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
