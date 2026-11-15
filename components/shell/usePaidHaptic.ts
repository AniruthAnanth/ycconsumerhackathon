import { useEffect, useRef } from "react";

import type { Id } from "@/convex/_generated/dataModel";
import type { MyLeague } from "@/lib/backend";
import { haptics } from "@/lib/native/haptics";

/**
 * The success tap when the buy-in goes through. Whop's webhook flips membership.paid while the
 * player is back from checkout, so this watches for false -> true in the same league; loading
 * a league that is already paid, or switching to one, stays silent.
 */
export function usePaidHaptic(membership: MyLeague | undefined) {
  const last = useRef<{ leagueId: Id<"leagues">; paid: boolean } | null>(null);
  useEffect(() => {
    if (!membership) return;
    const previous = last.current;
    if (previous?.leagueId === membership._id && !previous.paid && membership.paid) haptics.success();
    last.current = { leagueId: membership._id, paid: membership.paid };
  }, [membership]);
}
