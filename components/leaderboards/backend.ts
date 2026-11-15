import { makeFunctionReference } from "convex/server";

import type { Id } from "@/convex/_generated/dataModel";

import type { Board, BoardKey, Projection } from "./types";

/**
 * convex/leaderboards.ts, bound by name the way lib/backend.ts binds the shell's
 * modules, so these components typecheck and run whether or not the generated
 * api has that module yet. Once it has, swap these for api.leaderboards.
 */
export const leaderboards = {
  board: makeFunctionReference<"query", { leagueId: Id<"leagues">; board: BoardKey }, Board>("leaderboards:board"),
  /** Null in a free league. `at` is the current time rounded to the hour. */
  projection: makeFunctionReference<"query", { leagueId: Id<"leagues">; at?: number }, Projection | null>("leaderboards:projection"),
  sync: makeFunctionReference<"mutation", { leagueId: Id<"leagues"> }, null>("leaderboards:sync"),
};
