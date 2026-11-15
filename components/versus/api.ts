/**
 * The versus backend (convex/versus.ts) as typed function references.
 *
 * Bound by name, like lib/backend.ts, so these screens typecheck against the
 * agreed contract whether or not the backend module has landed on main.
 */
import { makeFunctionReference } from "convex/server";

import type { Id } from "@/convex/_generated/dataModel";

import type { Stake } from "@/components/join/stakes";

export type VersusPlayer = { userId: Id<"users">; name: string; paid: boolean };

export type Versus = {
  leagueId: Id<"leagues">;
  inviteCode: string;
  stakeUsd: number;
  /** waiting: nobody has accepted the invite yet. */
  status: "waiting" | "live" | "settled";
  me: VersusPlayer;
  opponent: VersusPlayer | null;
  potUsd: number;
  endsAt: number;
  /** Only once settled. A null winner is a tie. */
  result?: {
    winnerId: Id<"users"> | null;
    payouts: { userId: Id<"users">; name: string; amountUsd: number }[];
  };
};

export const versusApi = {
  challenge: makeFunctionReference<
    "mutation",
    { stakeUsd: Stake; opponentId?: Id<"users">; opponentPhone?: string },
    { leagueId: Id<"leagues">; inviteCode: string; opponentName: string | null }
  >("versus:challenge"),
  friends: makeFunctionReference<"query", Record<string, never>, { userId: Id<"users">; name: string }[]>("versus:friends"),
  /** Null when the league is not a versus. */
  get: makeFunctionReference<"query", { leagueId: Id<"leagues"> }, Versus | null>("versus:get"),
  rematch: makeFunctionReference<"mutation", { leagueId: Id<"leagues"> }, { leagueId: Id<"leagues"> }>("versus:rematch"),
  /** Turns the same league into an ordinary one with room for more friends. */
  toLeague: makeFunctionReference<"mutation", { leagueId: Id<"leagues"> }, { leagueId: Id<"leagues">; inviteCode: string }>(
    "versus:toLeague",
  ),
};
