import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type Market = NonNullable<FunctionReturnType<typeof api.markets.week>>;

/** The current week's market for the caller. Undefined while loading, null outside a league week. */
export function useMarket(leagueId: Id<"leagues"> | null | undefined): Market | null | undefined {
  return useQuery(api.markets.week, leagueId ? { leagueId } : "skip");
}
