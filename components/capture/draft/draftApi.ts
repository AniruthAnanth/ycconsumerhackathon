import { makeFunctionReference } from "convex/server";

import type { Id } from "@/convex/_generated/dataModel";

import type { DraftResult, DraftTask } from "./types";

// Stand-ins for api.proofs.generateUploadUrl, api.lineup.draft and api.lineup.lock until the
// backend threads' modules appear in convex/_generated/api.d.ts. The shapes follow API.md.
export const draftApi = {
  generateUploadUrl: makeFunctionReference<"mutation", Record<string, never>, string>("proofs:generateUploadUrl"),
  draft: makeFunctionReference<
    "action",
    { audioStorageId?: Id<"_storage">; transcript?: string },
    DraftResult
  >("lineup:draft"),
  lock: makeFunctionReference<"mutation", { tasks: DraftTask[]; transcript?: string }, { weekStart: number }>(
    "lineup:lock",
  ),
};
