import type { FunctionReturnType } from "convex/server";

import type { api } from "@/convex/_generated/api";

export type InviteMode = FunctionReturnType<typeof api.referrals.accept>["mode"];

export type RecruiterSummary = FunctionReturnType<typeof api.referrals.forUser>;

export type RecruitedFriend = FunctionReturnType<typeof api.referrals.mine>["friends"][number];
