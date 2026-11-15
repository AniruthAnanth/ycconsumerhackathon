import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { hourStart } from "./format";

/** The league projection: undefined while it loads, null in a free league. */
export function useProjection(leagueId: Id<"leagues"> | null) {
  const at = useMemo(() => hourStart(Date.now()), []);
  return useQuery(api.leaderboards.projection, leagueId ? { leagueId, at } : "skip");
}
