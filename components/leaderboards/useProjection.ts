import { useQuery } from "convex/react";
import { useMemo } from "react";

import { leaderboards } from "@/components/leaderboards/backend";
import type { Id } from "@/convex/_generated/dataModel";

import { hourStart } from "./format";

/** The league projection: undefined while it loads, null in a free league. */
export function useProjection(leagueId: Id<"leagues"> | null) {
  const at = useMemo(() => hourStart(Date.now()), []);
  return useQuery(leaderboards.projection, leagueId ? { leagueId, at } : "skip");
}
