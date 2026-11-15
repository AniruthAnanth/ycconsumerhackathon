import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Resolves the caller to the users row they play as. Every public query and
 * mutation starts here; never take a user id from the client to decide who is
 * calling.
 *
 * The demo control "Switch Player" sets users.demoActAs on the signed-in row,
 * and this returns the seeded player it names, so one phone can play several
 * accounts without signing out.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Not signed in");
  }
  const signedIn = await ctx.db.get("users", userId);
  if (signedIn === null) {
    throw new ConvexError("The signed-in user no longer exists");
  }
  if (signedIn.demoActAs === undefined) {
    return signedIn;
  }
  const actedAs = await ctx.db.get("users", signedIn.demoActAs);
  return actedAs ?? signedIn;
}
