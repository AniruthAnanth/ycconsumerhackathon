/**
 * Voice Draft's bucket chips: while the player talks, which of the five buckets the words so far
 * mention. The app matches keywords itself; this cheap model pass catches what keywords miss
 * ("pick up the kids" is People). Best effort: any failure is an empty answer, never an error.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { classifyBuckets, CORE_BUCKETS } from "./ai";

// A take is under a minute of speech; anything longer is not a live transcript.
const MAX_TEXT = 2000;

export const classify = action({
  args: { text: v.string() },
  returns: v.array(v.union(...CORE_BUCKETS.map((bucket) => v.literal(bucket)))),
  handler: async (ctx, { text }) => {
    await ctx.runQuery(internal.lineup.callerId, {});
    if (text.trim() === "") return [];
    return await classifyBuckets(text.slice(0, MAX_TEXT)).catch((error) => {
      console.warn("live buckets failed:", error instanceof Error ? error.message : error);
      return [];
    });
  },
});
