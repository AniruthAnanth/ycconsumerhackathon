import { useQuery } from "convex/react";

import { DropActions } from "@/components/capture/DropActions";
import { Banner, type IconName } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { backend, type Drop } from "@/lib/backend";
import { pickBannerDrop } from "@/lib/roster";
import { useNow } from "@/lib/useNow";

/**
 * The one live thing on Roster: a quick-time drop, the daily mystery task or a
 * group session. Renders nothing when nothing is live.
 *
 * This file decides which drop gets the strip and names it. Its countdown and
 * what the player can do about it (Submit, or Open, Pass and the wager for a
 * sealed mystery task) are DropActions, which belongs to the capture screens.
 */
export function DropBanner({ leagueId }: { leagueId: Id<"leagues"> }) {
  const drops = useQuery(backend.drops.active, { leagueId });
  // Re-checked every second so the strip leaves the moment its drop closes.
  const drop = pickBannerDrop(drops ?? [], useNow(1000));
  if (!drop) return null;

  // A sealed mystery task keeps its title hidden until the player opens it.
  const sealed = drop.kind === "mystery" && drop.sealed;
  return (
    <Banner
      tone="live"
      icon={sealed ? "mail" : KIND[drop.kind].icon}
      title={sealed ? "Mystery task" : drop.title}
      subtitle={sealed ? undefined : (drop.place?.name ?? KIND[drop.kind].label)}
    >
      <DropActions drop={drop} leagueId={leagueId} />
    </Banner>
  );
}

const KIND: Record<Drop["kind"], { icon: IconName; label: string }> = {
  quicktime: { icon: "flash", label: "Quick-time drop" },
  mystery: { icon: "mail-open", label: "Mystery task" },
  group: { icon: "people", label: "Group session" },
};
