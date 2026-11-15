import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useNow } from "@/lib/useNow";

import { hourStart } from "./format";

/** The league projection: undefined while it loads, null in a free league. */
export function useProjection(leagueId: Id<"leagues"> | null) {
  const at = hourStart(useNow(60_000));
  return useQuery(api.leaderboards.projection, leagueId ? { leagueId, at } : "skip");
}
