import { useQuery } from "convex/react";
import type { ReactNode } from "react";

import { DropActions } from "@/components/capture/DropActions";
import { Banner, type IconName } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { backend, type Drop } from "@/lib/backend";
import { pickBannerDrop } from "@/lib/roster";
import { useNow } from "@/lib/useNow";

/**
 * The one live thing on Roster: a quick-time drop or a group session. Renders `fallback` when nothing is live.
 *
 * This file decides which drop gets the strip and names it. Its countdown and
 * what the player can do about it (Submit, or check in for a group session) are DropActions, which belongs to the capture screens.
 */
export function DropBanner({ leagueId, fallback = null }: { leagueId: Id<"leagues">; fallback?: ReactNode }) {
  const drops = useQuery(backend.drops.active, { leagueId });
  // Re-checked every second so the strip leaves the moment its drop closes.
  const drop = pickBannerDrop(drops ?? [], useNow(1000));
  const kind = drop && KIND[drop.kind];
  // Roster shows one banner at a time, so the nudge below a drop only shows when no drop is live.
  if (!drop || !kind) return fallback;

  return (
    <Banner
      tone="live"
      icon={kind.icon}
      title={drop.title}
      subtitle={drop.place?.name ?? kind.label}
    >
      <DropActions drop={drop} />
    </Banner>
  );
}

const KIND: Partial<Record<Drop["kind"], { icon: IconName; label: string }>> = {
  quicktime: { icon: "flash", label: "Quick-time drop" },
  group: { icon: "people", label: "Group session" },
};
