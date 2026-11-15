import { useAction } from "convex/react";
import { useState } from "react";

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
  const [state, setState] = useState<"idle" | "opening" | "failed">("idle");
  const [checkout, setCheckout] = useState<{ embedUrl: string; purchaseUrl: string } | null>(null);

  async function pay() {
    setState("opening");
    try {
      setCheckout(await createCheckout({ leagueId }));
      setState("idle");
    } catch {
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
} as const;
