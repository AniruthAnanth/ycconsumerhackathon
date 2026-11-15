import { useAction } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";

import { Banner } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";

type Props = { leagueId: Id<"leagues">; stakeUsd: number };

/**
 * Shown on Roster until the buy-in is paid. An unpaid member plays fully but
 * can't win the pot, so this is a nudge rather than a wall.
 *
 * It opens Whop's hosted checkout in the in-app browser. The banner goes away
 * when Whop's webhook marks the membership paid and users.me() updates, never
 * because the browser closed: closing it proves nothing.
 */
export function PayBanner({ leagueId, stakeUsd }: Props) {
  const createCheckout = useAction(backend.whop.createCheckout);
  const [state, setState] = useState<"idle" | "opening" | "failed">("idle");

  async function pay() {
    setState("opening");
    try {
      const { purchaseUrl } = await createCheckout({ leagueId });
      await WebBrowser.openBrowserAsync(purchaseUrl);
      setState("idle");
    } catch {
      setState("failed");
    }
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
  idle: "Unpaid players can't win the pot",
  opening: "Opening checkout...",
  failed: "Checkout didn't open. Tap to try again.",
} as const;
