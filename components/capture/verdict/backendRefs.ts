import { makeFunctionReference } from "convex/server";

import type { Id } from "@/convex/_generated/dataModel";

import type { Verdict, VerifyMediaArgs } from "./submitProof";

export const generateUploadUrl = makeFunctionReference<"mutation", Record<string, never>, string>(
  "proofs:generateUploadUrl",
);

export const verifyProof = makeFunctionReference<
  "action",
  Omit<VerifyMediaArgs, "taskId"> & { taskId: Id<"tasks"> },
  Verdict
>("proofs:verify");

export const verifyCanvas = makeFunctionReference<"action", { taskId: Id<"tasks"> }, Verdict>("canvas:verify");
