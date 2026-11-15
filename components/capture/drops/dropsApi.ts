import { makeFunctionReference } from "convex/server";

import type { Id } from "@/convex/_generated/dataModel";

export const acceptMystery = makeFunctionReference<
  "mutation",
  { dropId: Id<"drops">; wager?: number },
  null
>("drops:acceptMystery");

export const passMystery = makeFunctionReference<"mutation", { dropId: Id<"drops"> }, null>(
  "drops:passMystery",
);
