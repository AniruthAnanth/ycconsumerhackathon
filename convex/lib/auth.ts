import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * The users row of the device that is signed in, ignoring Switch Player, or
 * null when signed out. Only code that manages the account itself wants this:
 * onboarding fills the row in and Switch Player writes demoActAs on it.
 * Everything else calls requireUser.
 */
export async function signedInUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  return userId === null ? null : await ctx.db.get("users", userId);
}

/** signedInUser, for callers that can't proceed without an account. */
export async function requireSignedInUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const signedIn = await signedInUser(ctx);
  if (signedIn === null) {
    throw new ConvexError("Not signed in");
  }
  return signedIn;
}

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
  const signedIn = await requireSignedInUser(ctx);
  if (signedIn.demoActAs === undefined) {
    return signedIn;
  }
  const actedAs = await ctx.db.get("users", signedIn.demoActAs);
  return actedAs ?? signedIn;
}
