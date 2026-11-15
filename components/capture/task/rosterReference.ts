import { makeFunctionReference } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";

import type { RosterTask } from "./taskSheet";

export const rosterReference = makeFunctionReference<
  "query",
  { leagueId?: Id<"leagues">; userId?: Id<"users">; weekStart?: number },
  { locked: boolean; weekStart: number; total: number; rows: RosterTask[] }
>("lineup:roster");
