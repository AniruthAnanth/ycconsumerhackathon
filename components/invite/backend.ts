/**
 * The referrals slice of the backend contract (API.md, "referrals.ts"), bound by
 * name so the invite screens typecheck before convex/referrals.ts lands on main.
 * Shapes mirror API.md exactly; change them there first.
 */
import { makeFunctionReference } from "convex/server";

import type { Id } from "@/convex/_generated/dataModel";

export type InviteMode = "league" | "versus";
export type RecruiterBadgeName = "Recruiter" | "Top Recruiter";

export type InvitePreview = {
  inviterName: string;
  leagueId: Id<"leagues">;
  leagueName: string;
  mode: InviteMode;
  stakeUsd: number;
  memberCount: number;
  alreadyMember: boolean;
  isSelf: boolean;
};

export type RecruiterSummary = {
  recruiterPoints: number;
  invited: number;
  locked: number;
  badge: RecruiterBadgeName | null;
};

export type RecruitedFriend = { userId: Id<"users">; name: string; status: "joined" | "locked"; points: number };

export type MyReferrals = RecruiterSummary & { friends: RecruitedFriend[] };

export const referrals = {
  createLink: makeFunctionReference<
    "mutation",
    { leagueId: Id<"leagues">; appUrl?: string },
    { token: string; url: string; message: string }
  >("referrals:createLink"),
  preview: makeFunctionReference<"query", { token: string }, InvitePreview | null>("referrals:preview"),
  accept: makeFunctionReference<"mutation", { token: string }, { leagueId: Id<"leagues">; mode: InviteMode }>("referrals:accept"),
  mine: makeFunctionReference<"query", Record<string, never>, MyReferrals>("referrals:mine"),
  forUser: makeFunctionReference<"query", { userId: Id<"users"> }, RecruiterSummary>("referrals:forUser"),
} as const;
